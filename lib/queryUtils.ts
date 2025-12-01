import { SupabaseClient, PostgrestFilterBuilder } from '@supabase/supabase-js'

interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  timeout?: number
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  timeout: 5000, // 5 second timeout per query
}

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ])
}

/**
 * Executes a query with retry logic and exponential backoff
 */
export async function withRetry<T>(
  queryFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | null = null
  let delay = opts.initialDelay

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Wrap query with timeout
      const result = await withTimeout(queryFn(), opts.timeout)
      return result
    } catch (error) {
      lastError = error as Error

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break
      }

      // Don't retry on certain errors (auth, permission, not found, etc.)
      if (isNonRetryableError(error)) {
        throw error
      }

      // Wait before retrying with exponential backoff
      await sleep(Math.min(delay, opts.maxDelay))
      delay *= 2 // Double the delay for next attempt
    }
  }

  throw lastError || new Error('Query failed after all retries')
}

/**
 * Helper to check if an error should not be retried
 */
function isNonRetryableError(error: any): boolean {
  if (!error) return false

  const message = error.message?.toLowerCase() || ''
  const code = error.code || ''

  // Don't retry auth errors, permission errors, or not found errors
  if (
    message.includes('jwt') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('not found') ||
    code === 'PGRST301' || // JWT error
    code === 'PGRST204' || // No rows
    code === '42501' // Insufficient privilege
  ) {
    return true
  }

  return false
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Rate limiter for concurrent queries
 */
export class QueryRateLimiter {
  private queue: Array<() => void> = []
  private activeCount = 0

  constructor(private maxConcurrent: number = 3) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot if at capacity
    if (this.activeCount >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    this.activeCount++

    try {
      return await fn()
    } finally {
      this.activeCount--

      // Release next queued item
      const next = this.queue.shift()
      if (next) {
        next()
      }
    }
  }
}

/**
 * Batch query executor with rate limiting
 */
export async function executeBatch<T, R>(
  items: T[],
  queryFn: (item: T) => Promise<R>,
  options: { maxConcurrent?: number; retryOptions?: RetryOptions } = {}
): Promise<R[]> {
  const limiter = new QueryRateLimiter(options.maxConcurrent || 3)

  const promises = items.map((item) =>
    limiter.execute(() => withRetry(() => queryFn(item), options.retryOptions))
  )

  return Promise.all(promises)
}

/**
 * Supabase-specific query wrapper with timeout and retry
 */
export async function querySupabase<T>(
  queryBuilder: PostgrestFilterBuilder<any, any, T[]>,
  options: RetryOptions = {}
): Promise<T[]> {
  return withRetry(async () => {
    const { data, error } = await queryBuilder

    if (error) {
      throw error
    }

    return data || []
  }, options)
}

/**
 * Supabase transaction wrapper (uses RPC for atomic operations)
 */
export async function withTransaction<T>(
  supabase: SupabaseClient,
  transactionFn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  // Supabase doesn't support traditional transactions in the client
  // For atomic operations, we'll use RPC functions or handle rollback manually

  try {
    return await transactionFn(supabase)
  } catch (error) {
    // In a real transaction, we'd rollback here
    // For Supabase, consider using RPC functions for complex atomic operations
    throw error
  }
}
