// Fitbit OAuth + API endpoints and app-level constants. Safe to import anywhere
// (no secrets here — those come from server env at call time).

export const FITBIT_AUTHORIZE_URL = 'https://www.fitbit.com/oauth2/authorize'
export const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token'
export const FITBIT_REVOKE_URL = 'https://api.fitbit.com/oauth2/revoke'
export const FITBIT_ACTIVITIES_URL = 'https://api.fitbit.com/1/user/-/activities/list.json'

// Minimal scopes: workout logs + heart-rate (for intensity derivation).
export const FITBIT_SCOPES = 'activity heartrate'

// en_US forces miles in distance fields, matching the app's default unit.
export const FITBIT_LOCALE = 'en_US'

// Cookie that carries the PKCE verifier + CSRF state between /connect and
// /callback. Short-lived, httpOnly.
export const FITBIT_OAUTH_COOKIE = 'rj_fitbit_oauth'

// Curated activity types the user can choose to import (matched case-insensitively
// against Fitbit's activityName). Sensible default = the common cardio ones.
export const FITBIT_ACTIVITY_OPTIONS = [
  'Run',
  'Walk',
  'Bike',
  'Outdoor Bike',
  'Spinning',
  'Treadmill',
  'Elliptical',
  'Swim',
  'Hike',
  'Workout',
  'Interval Workout',
  'Aerobic Workout',
  'Sport',
  'Yoga',
] as const

export const FITBIT_DEFAULT_ALLOWED = ['Run', 'Walk', 'Bike', 'Outdoor Bike', 'Spinning', 'Treadmill', 'Elliptical', 'Swim', 'Hike']
