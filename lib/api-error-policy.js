/**
 * Build a client-safe API error payload.
 * Internal diagnostics belong in server logs only in production.
 */
export function safeApiErrorPayload(error, fallback, env = process.env.NODE_ENV) {
  const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
  const hideInternal =
    status >= 500 || /sqlite|postgres|constraint|pragma|undefined/i.test(String(error?.message || ''));
  const message = hideInternal ? fallback : error?.message || fallback;
  const payload = { error: message };

  if (env === 'development') {
    payload.debugMessage = error?.message;
    payload.debugStack = error?.stack;
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    payload,
  };
}

