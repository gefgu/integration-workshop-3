import type { NeonConfig } from './neonApi';

/**
 * Set both in teacher_mobile_app/.env to make the phone talk to Neon directly (see README). Leave them out to keep
 * using the TedTronics server address typed on the login screen. Expo inlines EXPO_PUBLIC_* only when written literally.
 */
export const neonConfig: NeonConfig | null =
  process.env.EXPO_PUBLIC_NEON_AUTH_URL && process.env.EXPO_PUBLIC_NEON_REST_URL
    ? { authUrl: process.env.EXPO_PUBLIC_NEON_AUTH_URL, restUrl: process.env.EXPO_PUBLIC_NEON_REST_URL }
    : null;
