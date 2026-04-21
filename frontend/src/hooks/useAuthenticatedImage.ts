import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

type Status = "idle" | "loading" | "loaded" | "error";

// In-memory cache across component mounts — key is BASE+path.
// Blob URLs are refcounted and only revoked when refcount hits 0.
const cache = new Map<string, { url: string; refs: number }>();

function addRef(key: string, url: string) {
  const entry = cache.get(key);
  if (entry) {
    entry.refs += 1;
    return entry.url;
  }
  cache.set(key, { url, refs: 1 });
  return url;
}

function releaseRef(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    cache.delete(key);
  }
}

/**
 * Fetches an image with Authorization: Bearer header, returns an object URL.
 * Keeps token out of the URL query string and logs.
 */
export function useAuthenticatedImage(path: string | null | undefined) {
  const token = useAuthStore((s) => s.token);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const activeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!path || !token) {
      setObjectUrl(null);
      setStatus("idle");
      return;
    }

    const fullUrl = `${BASE_URL}${path}`;
    const key = fullUrl;
    let cancelled = false;

    // Reuse cached URL
    const cached = cache.get(key);
    if (cached) {
      cached.refs += 1;
      activeKeyRef.current = key;
      setObjectUrl(cached.url);
      setStatus("loaded");
      return () => {
        releaseRef(key);
      };
    }

    setStatus("loading");
    fetch(fullUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        addRef(key, url);
        activeKeyRef.current = key;
        setObjectUrl(url);
        setStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setObjectUrl(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      if (activeKeyRef.current) {
        releaseRef(activeKeyRef.current);
        activeKeyRef.current = null;
      }
    };
  }, [path, token]);

  return { src: objectUrl, status };
}
