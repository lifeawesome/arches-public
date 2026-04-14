import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { CirclePollWithResults, CirclePollResultRow } from "@/types/circles";
import { Markdown } from "@/components/common/Markdown";
import { PollResultsBars } from "@/components/circles/polls/PollResultsBars";

export function CirclePollCard({
  poll,
}: {
  poll: CirclePollWithResults;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [results, setResults] = useState<CirclePollResultRow[]>(poll.results ?? []);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current user's vote (allowed by RLS: user_id = auth.uid()).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("circle_poll_votes")
        .select("option_index")
        .eq("poll_id", poll.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) return;
      if (data && typeof (data as any).option_index === "number") {
        setSelectedIndex((data as any).option_index as number);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, poll.id]);

  // Realtime subscription to aggregated results only (privacy-preserving).
  useEffect(() => {
    const channel = supabase
      .channel(`circle-poll-results:${poll.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "circle_poll_results",
          filter: `poll_id=eq.${poll.id}`,
        },
        (payload: any) => {
          const next = payload?.new ?? payload?.old;
          if (!next) return;
          const option_index = next.option_index as number;
          const vote_count = next.vote_count as number;
          if (typeof option_index !== "number" || typeof vote_count !== "number") return;

          setResults((prev) => {
            const map = new Map<number, number>();
            for (const r of prev) map.set(r.option_index, r.vote_count);
            map.set(option_index, vote_count);
            const arr = Array.from(map.entries())
              .map(([i, c]) => ({ option_index: i, vote_count: c }))
              .sort((a, b) => a.option_index - b.option_index);
            return arr;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, poll.id]);

  const vote = async (idx: number) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/circle-polls/${encodeURIComponent(poll.id)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_index: idx }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to vote");
      }
      setSelectedIndex(idx);
      // Results will update via realtime; we intentionally do not refetch here.
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">Poll</h3>
      </div>

      <div className="mt-2 text-sm text-foreground">
        <Markdown>{poll.question}</Markdown>
      </div>

      <div className="mt-4 space-y-2">
        {poll.options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={submitting}
            onClick={() => vote(idx)}
            className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            <span>{opt}</span>
            <span className="text-xs text-muted-foreground">
              {selectedIndex === idx ? "Selected" : "Vote"}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-5">
        <PollResultsBars options={poll.options} results={results} selectedIndex={selectedIndex} />
      </div>
    </article>
  );
}

