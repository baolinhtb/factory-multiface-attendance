import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const STORAGE_KEY = 'backend_base_url';
export const DEFAULT_API_URL =
    (import.meta as any)?.env?.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

const normalizeBaseUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_API_URL;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    try {
        const url = new URL(withScheme);
        if (!url.port) url.port = '8000';
        url.pathname = url.pathname.replace(/\/+$/, '');
        return url.toString().replace(/\/$/, '');
    } catch {
        return DEFAULT_API_URL;
    }
};

export const getApiBaseUrl = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeBaseUrl(stored) : DEFAULT_API_URL;
};

export const setApiBaseUrl = (value: string) => {
    const normalized = normalizeBaseUrl(value);
    localStorage.setItem(STORAGE_KEY, normalized);
    api.defaults.baseURL = normalized;
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default api;
