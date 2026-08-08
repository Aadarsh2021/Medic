import { useAuthStore } from '../store/useAuthStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5555';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Try direct localStorage key
  const directToken = localStorage.getItem('accessToken');
  if (directToken) return directToken;

  // 2. Try Zustand in-memory store
  try {
    const storeToken = useAuthStore.getState().accessToken;
    if (storeToken) {
      localStorage.setItem('accessToken', storeToken);
      return storeToken;
    }
  } catch (e) {}

  // 3. Try Zustand persisted storage JSON
  try {
    const zustandRaw = localStorage.getItem('medcore-auth-storage');
    if (zustandRaw) {
      const parsed = JSON.parse(zustandRaw);
      const token = parsed.state?.accessToken;
      if (token) {
        localStorage.setItem('accessToken', token);
        return token;
      }
    }
  } catch (e) {}

  return null;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized with token refresh retry
  if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const refreshJson = await refreshRes.json();

        if (refreshRes.ok && refreshJson.success && refreshJson.data?.accessToken) {
          const newToken = refreshJson.data.accessToken;
          const user = refreshJson.data.user || useAuthStore.getState().currentUser;
          useAuthStore.getState().setAuth(user, newToken);
          isRefreshing = false;
          processQueue(null, newToken);

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
          });
        } else {
          isRefreshing = false;
          processQueue(new Error('Session expired'), null);
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    } else {
      // Queue requests while refreshing
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            headers['Authorization'] = `Bearer ${newToken}`;
            fetch(`${API_BASE}${endpoint}`, { ...options, headers })
              .then((r) => r.json())
              .then((json) => {
                if (!json.success) reject(new Error(json.error?.message || 'API request failed'));
                else resolve(json.data);
              })
              .catch(reject);
          },
          reject: (err: any) => reject(err),
        });
      });
    }
  }

  const json = await response.json();

  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data;
}

export { API_BASE };
