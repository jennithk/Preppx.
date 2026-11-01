export class StudentApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function studentApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/student${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `The request failed (${response.status}).`;
    throw new StudentApiError(message, response.status);
  }
  return body as T;
}
