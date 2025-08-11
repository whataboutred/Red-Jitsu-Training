import { NextRequest, NextResponse } from 'next/server'
import { logger, EventType } from '@/lib/splunkLogger'

export function middleware(request: NextRequest) {
  const start = Date.now()
  
  // Log API requests
  if (request.nextUrl.pathname.startsWith('/api/')) {
    logger.info(
      EventType.API_REQUEST,
      `API Request: ${request.method} ${request.nextUrl.pathname}`,
      {
        method: request.method,
        path: request.nextUrl.pathname,
        query: Object.fromEntries(request.nextUrl.searchParams),
        user_agent: request.headers.get('user-agent'),
        ip_address: request.ip || request.headers.get('x-forwarded-for')
      }
    )
  }

  // Continue with the request
  const response = NextResponse.next()

  // Log response time
  const duration = Date.now() - start
  if (request.nextUrl.pathname.startsWith('/api/')) {
    logger.debug(
      EventType.API_REQUEST,
      `API Response: ${response.status} in ${duration}ms`,
      {
        status: response.status,
        duration_ms: duration,
        path: request.nextUrl.pathname
      }
    )
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}