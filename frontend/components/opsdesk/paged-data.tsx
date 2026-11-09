"use client";

import { useEffect, useState } from "react";
import { request } from "./ui";

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function useOpsResource<T>(path: string | null, refreshKey: string) {
  const [result, setResult] = useState<{
    path: string;
    data?: T;
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void request(path)
      .then((data: T) => {
        if (!cancelled) setResult({ path, data });
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setResult({
            path,
            error:
              cause instanceof Error
                ? cause.message
                : "Could not load records.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [path, refreshKey, retry]);
  return {
    data: result?.path === path ? result.data : undefined,
    error: result?.path === path ? result.error : undefined,
    retry: () => setRetry((v) => v + 1),
  };
}

export function useOpsPage<T>(path: string | null, refreshKey: string) {
  const [navigation, setNavigation] = useState({ path, page: 1 });
  const page = navigation.path === path ? navigation.page : 1;
  const result = useOpsResource<Page<T>>(
    path ? `${path}${path.includes("?") ? "&" : "?"}page=${page}` : null,
    refreshKey,
  );
  return {
    ...result,
    go: (next: number) => setNavigation({ path, page: next }),
  };
}

export function PageControls<T>({
  resource,
  label,
}: {
  resource: ReturnType<typeof useOpsPage<T>>;
  label: string;
}) {
  if (resource.error)
    return (
      <p role="alert">
        {resource.error}{" "}
        <button type="button" className="od-secondary" onClick={resource.retry}>
          Retry {label}
        </button>
      </p>
    );
  if (!resource.data) return <p role="status">Loading {label}…</p>;
  const { page, totalPages, total } = resource.data;
  return (
    <nav className="od-flex od-space" aria-label={`${label} pagination`}>
      <span>
        {total} {label} · Page {page} of {totalPages}
      </span>
      {totalPages > 1 && (
        <>
          <button
            type="button"
            className="od-secondary"
            disabled={page <= 1}
            onClick={() => resource.go(page - 1)}
          >
            Newer {label}
          </button>
          <button
            type="button"
            className="od-secondary"
            disabled={page >= totalPages}
            onClick={() => resource.go(page + 1)}
          >
            Older {label}
          </button>
        </>
      )}
    </nav>
  );
}
