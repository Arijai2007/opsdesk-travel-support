"use client";

import { useEffect, useState } from "react";
import type { TravelQueuePage } from "@helpdesk/shared";
import type { Ticket } from "@/lib/opsdesk-types";
type QueueRows = TravelQueuePage & {
  items: Omit<
    Ticket,
    "description" | "messages" | "events" | "relatedIds" | "summary"
  >[];
};
import { request } from "./ui";

export function useTravelQueue(
  userId: string | undefined,
  enabled: boolean,
  filters: Record<string, string>,
  refreshKey: string | undefined,
) {
  const filterKey = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value && value !== "ALL"),
  ).toString();
  const key = userId ? `${userId}:${filterKey}` : "";
  const [navigation, setNavigation] = useState({ key: "", page: 1 });
  const page = navigation.key === key ? navigation.page : 1;
  const query = `${filterKey}&page=${page}`;
  const resultKey = `${key}:${page}`;
  const [result, setResult] = useState<{
    key: string;
    data?: QueueRows;
    error?: string;
  }>();

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void request(`queue?${query}`)
        .then((data: QueueRows) => {
          if (!cancelled) setResult({ key: resultKey, data });
        })
        .catch((cause: unknown) => {
          if (!cancelled)
            setResult({
              key: resultKey,
              error:
                cause instanceof Error
                  ? cause.message
                  : "Could not load the inbox.",
            });
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, userId, query, resultKey, refreshKey]);

  return {
    data: result?.key === resultKey ? result.data : undefined,
    error: result?.key === resultKey ? result.error : undefined,
    goToPage: (next: number) => setNavigation({ key, page: next }),
  };
}
