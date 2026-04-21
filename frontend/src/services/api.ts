import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 3000;

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  silent?: boolean;
  _retryCount?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, silent, _retryCount = 0, ...fetchOptions } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (
    fetchOptions.body &&
    typeof fetchOptions.body === "string"
  ) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (networkError) {
    // Network error (server unreachable, DB sleep) — retry once
    if (_retryCount < MAX_RETRIES) {
      toast.loading("Conectando con el servidor... un momento", { id: "retry-connect" });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return request<T>(path, { ...options, _retryCount: _retryCount + 1 });
    }
    toast.dismiss("retry-connect");
    toast.error("No se pudo conectar al servidor");
    throw networkError;
  }

  // 503 = server/DB waking up — retry once
  if (response.status === 503 && _retryCount < MAX_RETRIES) {
    toast.loading("Conectando con el servidor... un momento", { id: "retry-connect" });
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return request<T>(path, { ...options, _retryCount: _retryCount + 1 });
  }
  toast.dismiss("retry-connect");

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new Error("Sesion expirada");
  }

  if (!response.ok) {
    let detail = `Error ${response.status}`;
    try {
      const err = await response.json();
      const raw = err.detail;
      if (typeof raw === "string") {
        detail = raw;
      } else if (Array.isArray(raw)) {
        detail = raw.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
      } else if (raw) {
        detail = JSON.stringify(raw);
      }
    } catch {
      // ignore json parse error
    }
    // Suppress toast for:
    //   - Explicit silent requests
    //   - 404 on GET (usually optional/missing data, not a user action)
    //   - 422 on GET (stale route or bad query param — let caller handle)
    const method = (fetchOptions.method || "GET").toUpperCase();
    const isGet = method === "GET";
    const suppress =
      silent ||
      (isGet && (response.status === 404 || response.status === 422));
    if (!suppress) {
      // Dedup: identical errors on the same endpoint reuse the same id
      // so they replace instead of stacking.
      toast.error(detail, { id: `api-err:${method}:${path}:${detail.slice(0, 80)}` });
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export function get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  return request<T>(path, { params });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function uploadFile<T>(path: string, file: File, fieldName = "file"): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);
  return request<T>(path, {
    method: "POST",
    body: formData,
  });
}
