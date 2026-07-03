import axios from 'axios';
import { getAccessToken, setAccessToken } from './tokenStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api/v1',
  withCredentials: true, // HttpOnly refresh cookie 자동 전송
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터 — 메모리의 access token을 헤더에 주입
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 처리를 위한 재시도 큐 (동시 401이 여러 번 오는 경우 refresh를 1회만 호출)
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null): void {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  pendingQueue = [];
}

// 응답 인터셉터 — 401 → refresh 1회 시도 → 원요청 재시도
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // refresh 엔드포인트 자체가 401이면 무한루프 방지를 위해 바로 거부
    if (originalRequest?.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // 이미 refresh 중이면 큐에 대기
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        const newToken = data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        // 로그인 페이지로 이동 (router 의존성 없이 직접)
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
