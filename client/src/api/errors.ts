import { isAxiosError } from 'axios';

export type ApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limit'
  | 'validation'
  | 'server'
  | 'unknown';

export interface FriendlyApiError {
  kind: ApiErrorKind;
  message: string;
  retryable: boolean;
  status?: number;
}

const SERVER_MESSAGE_MAP: Array<[RegExp, string]> = [
  [/invalid email or password/i, 'The email or password you entered is incorrect.'],
  [/not verified|verify your email/i, 'Please verify your email before signing in.'],
  [/not active|suspended|banned|blocked/i, 'This account is currently blocked. Contact support if this looks wrong.'],
  [/too many|rate limit/i, 'Too many attempts. Please wait a moment and try again.'],
  [/expired session|expired access token|no refresh token|invalid.*session/i, 'Your session has expired. Please sign in again.'],
];

export function getFriendlyApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): FriendlyApiError {
  if (!isAxiosError(error)) return { kind: 'unknown', message: fallback, retryable: true };

  const status = error.response?.status;
  const serverMessage = (error.response?.data as { error?: string; message?: string } | undefined)?.error
    ?? (error.response?.data as { message?: string } | undefined)?.message;

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return { kind: 'timeout', message: 'The request took too long. Please try again.', retryable: true };
  }
  if (!error.response) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return {
      kind: 'offline',
      message: offline ? 'You’re offline. Check your connection and try again.' : 'We can’t reach NearMe right now. Please try again shortly.',
      retryable: true,
    };
  }

  const mappedMessage = serverMessage
    ? SERVER_MESSAGE_MAP.find(([pattern]) => pattern.test(serverMessage))?.[1] ?? serverMessage
    : undefined;

  if (status === 401) return { kind: 'unauthorized', message: mappedMessage ?? 'Your session has expired. Please sign in again.', retryable: false, status };
  if (status === 403) return { kind: 'forbidden', message: mappedMessage ?? 'You don’t have permission to do that.', retryable: false, status };
  if (status === 429) return { kind: 'rate_limit', message: mappedMessage ?? 'Too many attempts. Please wait and try again.', retryable: true, status };
  if (status === 400 || status === 409 || status === 422) return { kind: 'validation', message: mappedMessage ?? 'Please check the information you entered.', retryable: false, status };
  if (status && status >= 500) return { kind: 'server', message: 'NearMe is temporarily unavailable. Please try again shortly.', retryable: true, status };
  return { kind: 'unknown', message: mappedMessage ?? fallback, retryable: true, status };
}

export function isDefinitiveSessionFailure(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  return error.response?.status === 401 || error.response?.status === 403;
}
