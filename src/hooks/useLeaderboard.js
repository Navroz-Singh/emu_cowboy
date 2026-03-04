"use client";

import { useEffect, useMemo, useState } from "react";

export function useLeaderboard(gameId, { country = "", sort = "score" } = {}) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      if (!gameId) {
        setRows([]);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const searchParams = new URLSearchParams({ limit: "15" });
        if (country) searchParams.set("country", country);

        const response = await fetch(`/api/v1/scores/${gameId}?${searchParams.toString()}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || `Failed to load leaderboard (${response.status})`);
        }

        if (!isMounted) return;
        setRows(Array.isArray(payload.rows) ? payload.rows : []);
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
  }, [country, gameId]);

  const sortedRows = useMemo(() => {
    if (sort === "recent") {
      return [...rows].sort((left, right) => {
        const leftDate = new Date(left.achievedAt || 0).getTime();
        const rightDate = new Date(right.achievedAt || 0).getTime();
        return rightDate - leftDate;
      });
    }

    return [...rows].sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      const leftDate = new Date(left.achievedAt || 0).getTime();
      const rightDate = new Date(right.achievedAt || 0).getTime();
      return leftDate - rightDate;
    });
  }, [rows, sort]);

  const rankedRows = useMemo(
    () => sortedRows.map((row, index) => ({ ...row, rank: index + 1 })),
    [sortedRows]
  );

  return {
    rows: rankedRows,
    isLoading,
    error,
  };
}
