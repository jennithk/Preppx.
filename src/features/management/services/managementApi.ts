export type ManagementUser = {
  id: string;
  email: string;
  fullName: string;
};

export type ManagementRow = {
  id: string;
  [key: string]: unknown;
};

export class ManagementApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ManagementApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/management${path}`, {
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
    throw new ManagementApiError(message, response.status);
  }
  return body as T;
}

function uploadRequest<T>(path: string, data: FormData, onProgress?: (progress: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/management${path}`);
    xhr.withCredentials = true;
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status === 204) {
        resolve(undefined as T);
        return;
      }
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : `The request failed (${xhr.status}).`;
        reject(new Error(message));
        return;
      }
      resolve(body as T);
    });
    xhr.addEventListener('error', () => reject(new Error('The upload request could not be completed.')));
    xhr.addEventListener('abort', () => reject(new Error('The upload was cancelled.')));
    xhr.send(data);
  });
}

export const managementApi = {
  session: () => request<{ manager: ManagementUser }>('/auth/session'),
  login: (email: string, password: string) => request<{ manager: ManagementUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, data: FormData, onProgress?: (progress: number) => void) => uploadRequest<T>(path, data, onProgress),
};
