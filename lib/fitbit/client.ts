import 'server-only'
import {
  FITBIT_TOKEN_URL,
  FITBIT_REVOKE_URL,
  FITBIT_ACTIVITIES_URL,
  FITBIT_LOCALE,
} from './constants'
import type { FitbitActivity } from './map'

function basicAuthHeader(): string {
  const id = process.env.FITBIT_CLIENT_ID
  const secret = process.env.FITBIT_CLIENT_SECRET
  if (!id || !secret) throw new Error('FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET not set')
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64')
}

export type FitbitTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: string // ISO
  scope: string
  fitbitUserId: string
}

function parseTokenResponse(json: any): FitbitTokens {
  const expiresIn = Number(json.expires_in ?? 3600)
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: json.scope ?? '',
    fitbitUserId: json.user_id ?? '',
  }
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<FitbitTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: process.env.FITBIT_CLIENT_ID || '',
  })
  const res = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Fitbit token exchange failed: ${res.status} ${await res.text()}`)
  return parseTokenResponse(await res.json())
}

export async function refreshTokens(refreshToken: string): Promise<FitbitTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.FITBIT_CLIENT_ID || '',
  })
  const res = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Fitbit token refresh failed: ${res.status} ${await res.text()}`)
  return parseTokenResponse(await res.json())
}

export async function revokeToken(accessToken: string): Promise<void> {
  // Best-effort; ignore failure (token may already be invalid).
  try {
    await fetch(FITBIT_REVOKE_URL, {
      method: 'POST',
      headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: accessToken }),
    })
  } catch {
    /* ignore */
  }
}

// Fetch logged activities on/after a date (YYYY-MM-DD), oldest first.
export async function fetchActivitiesSince(
  accessToken: string,
  afterDate: string,
  limit = 100
): Promise<FitbitActivity[]> {
  const url = `${FITBIT_ACTIVITIES_URL}?afterDate=${afterDate}&sort=asc&offset=0&limit=${limit}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': FITBIT_LOCALE },
  })
  if (!res.ok) throw new Error(`Fitbit activities fetch failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return (json.activities ?? []) as FitbitActivity[]
}
