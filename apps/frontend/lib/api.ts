import { getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error('Network error — is the API server running?');
  }

  // Parse body as text first so we can safely inspect it
  const text = await res.text();

  if (!res.ok) {
    let message = res.statusText || 'Request failed';
    if (text) {
      try {
        const err = JSON.parse(text);
        const raw = err?.message;
        if (Array.isArray(raw)) message = raw.join(', ');
        else if (typeof raw === 'string' && raw) message = raw;
      } catch {
        // body wasn't JSON — use status text
      }
    }
    throw new Error(message);
  }

  if (!text || res.status === 204) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected response from server: ${text.slice(0, 100)}`);
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (body: { email: string; password: string; firstName: string; lastName: string; role: string }) =>
      request<{ accessToken: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ accessToken: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    profile: () => request<any>('/auth/profile'),
  },

  jobs: {
    list: (status?: string) =>
      request<any[]>(`/jobs${status ? `?status=${status}` : ''}`),
    get: (id: string) => request<any>(`/jobs/${id}`),
    create: (body: any) =>
      request<any>('/jobs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) =>
      request<any>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<void>(`/jobs/${id}`, { method: 'DELETE' }),
  },

  applications: {
    apply: (jobId: string, formData: FormData) => {
      const token = getToken();
      return fetch(`${BASE}/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(async (res) => {
        const text = await res.text();
        if (!res.ok) {
          let message = res.statusText;
          try {
            const err = JSON.parse(text);
            const raw = err?.message;
            message = Array.isArray(raw) ? raw.join(', ') : (raw || message);
          } catch { /* ignore */ }
          throw new Error(message);
        }
        return text ? JSON.parse(text) : undefined;
      });
    },
    list: (jobId: string) => request<any[]>(`/jobs/${jobId}/applications`),
  },

  screening: {
    screen: (body: any) =>
      request<any>('/screen', { method: 'POST', body: JSON.stringify(body) }),
    get: (applicationId: string) => request<any>(`/screen/${applicationId}`),
    ranked: (jobId: string, params?: Record<string, any>) => {
      const qs = params && Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';
      return request<any>(`/screen/ranked/${jobId}${qs}`);
    },
  },
};
