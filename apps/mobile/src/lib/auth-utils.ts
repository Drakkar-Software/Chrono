import { Platform } from 'react-native';
import { createURL } from 'expo-linking';
import {
  sendPasswordRecovery as anchorSendPasswordRecovery,
  verifyRecoveryOTP as anchorVerifyRecoveryOTP,
  createSessionFromUrl as anchorCreateSessionFromUrl,
} from '@drakkar.software/anchor';

import { globalSupabaseClient } from './supabase';

/**
 * URL Supabase should redirect to after any auth email link is clicked.
 * Web → the hosted `/auth-callback`; native → the `chrono://auth-callback`
 * deep link (built via expo-linking so it follows the app scheme).
 */
export function getAuthRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth-callback`;
  }
  return createURL('auth-callback');
}

/** Sign up, always attaching the email-confirmation redirect back to the app. */
export async function signUpWithOptions(
  email: string,
  password: string,
  options?: Record<string, unknown>,
) {
  return globalSupabaseClient.auth.signUp({
    email,
    password,
    options: {
      ...options,
      emailRedirectTo: getAuthRedirectTo(),
    },
  });
}

/** Send a password-recovery email (one-click link + 6-digit OTP fallback). */
export async function sendPasswordRecovery(email: string) {
  return anchorSendPasswordRecovery(globalSupabaseClient, email, {
    redirectTo: getAuthRedirectTo(),
  });
}

/** Verify a 6-digit OTP code from a recovery email (typed-code fallback). */
export async function verifyRecoveryOTP(email: string, otp: string) {
  return anchorVerifyRecoveryOTP(globalSupabaseClient, email, otp);
}

/** Parse auth tokens from a callback URL and establish a session. */
export async function createSessionFromUrl(url: string) {
  return anchorCreateSessionFromUrl(globalSupabaseClient, url);
}

const KNOWN_AUTH_ERRORS = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'email_exists',
  'weak_password',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'validation_failed',
  'user_not_found',
  'same_password',
  'signup_disabled',
]);

/**
 * Translation key for a Supabase auth error, so messages localize instead of
 * surfacing raw English. Falls back to a generic key for unmapped codes.
 */
export function authErrorKey(
  error: { code?: string | null; message?: string } | null | undefined,
): string {
  const code = error?.code;
  if (code && KNOWN_AUTH_ERRORS.has(code)) return `auth.errors.${code}`;
  return 'auth.errors.unknown';
}

