"use client";

import { useEffect, useMemo, useState } from "react";

import { useSessionStorage } from "@/hooks/useSessionStorage";

const LEADERBOARD_CACHE_TTL_MS = 60 * 1000;

export function useLeaderboard(gameId, { region = "", limit = 15 } = {}) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const cacheKey = useMemo(
    () => (gameId ? `leaderboard:${gameId}:${region || "WORLD"}:${String(limit)}` : ""),
    [region, gameId, limit],
  );
  const [cachedPayload, setCachedPayload] = useSessionStorage(cacheKey, null);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      if (!gameId) {
        setRows([]);
        return;
      }

      const cachedRows = Array.isArray(cachedPayload?.rows) ? cachedPayload.rows : null;
      const cachedFetchedAt = Number(cachedPayload?.fetchedAt || 0);
      const isCacheFresh = cachedRows && cachedFetchedAt > 0 && (Date.now() - cachedFetchedAt) < LEADERBOARD_CACHE_TTL_MS;

      if (isCacheFresh) {
        setRows(cachedRows);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const searchParams = new URLSearchParams({ limit: String(limit) });
        if (region) searchParams.set("region", region);

        const response = await fetch(`/api/v1/scores/${gameId}?${searchParams.toString()}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || `Failed to load leaderboard (${response.status})`);
        }

        if (!isMounted) return;
        const nextRows = Array.isArray(payload.rows) ? payload.rows : [];
        setRows(nextRows);
        setCachedPayload({
          rows: nextRows,
          fetchedAt: Date.now(),
        });
      } catch (fetchError) {
        if (!isMounted) return;
        setRows([]);
        setError(fetchError?.message || "Unable to load leaderboard.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [cachedPayload, gameId, limit, region, setCachedPayload]);

  const rankedRows = useMemo(
    () => rows.map((row, index) => ({ ...row, rank: index + 1 })),
    [rows]
  );

  return {
    rows: rankedRows,
    isLoading,
    error,
  };
}
