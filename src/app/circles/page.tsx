"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CircleCardComponent from "@/components/circles/CircleCardComponent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  CircleCategory,
  CircleDirectoryItem,
  CircleSearchResponse,
  CircleSearchSuggestion,
  CircleSearchSuggestionsResponse,
} from "@/types/circles";
import { Search, ChevronLeft, ChevronRight, Compass } from "lucide-react";

type DiscoveryRailProps = {
  title: string;
  description: string;
  railRef: React.RefObject<HTMLDivElement | null>;
  scrollRail: (ref: React.RefObject<HTMLDivElement | null>, dir: "left" | "right") => void;
  ariaLeft: string;
  ariaRight: string;
  accentClass: string;
  children: React.ReactNode;
};

function DiscoveryRailSection({
  title,
  description,
  railRef,
  scrollRail,
  ariaLeft,
  ariaRight,
  accentClass,
  children,
}: DiscoveryRailProps) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card/50 p-5 shadow-sm ring-1 ring-border/30 sm:p-6 dark:bg-card/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={`mt-1 hidden h-11 w-1 shrink-0 rounded-full sm:block ${accentClass}`}
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full shadow-xs"
            onClick={() => scrollRail(railRef, "left")}
            aria-label={ariaLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full shadow-xs"
            onClick={() => scrollRail(railRef, "right")}
            aria-label={ariaRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative mt-5 -mx-1">
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:thin]"
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export default function CircleDirectoryPage() {
  const router = useRouter();
  const [featured, setFeatured] = useState<CircleDirectoryItem[]>([]);
  const [trending, setTrending] = useState<CircleDirectoryItem[]>([]);
  const [recommended, setRecommended] = useState<CircleDirectoryItem[]>([]);
  const [categories, setCategories] = useState<CircleCategory[]>([]);
  const [circles, setCircles] = useState<CircleDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<CircleSearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [minMembers, setMinMembers] = useState<string>("");
  const [maxMembers, setMaxMembers] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const perPage = 20;

  const recommendedRef = useRef<HTMLDivElement | null>(null);
  const trendingRef = useRef<HTMLDivElement | null>(null);
  const featuredRef = useRef<HTMLDivElement | null>(null);

  const hasActiveQuery = useMemo(() => {
    return Boolean(
      search.trim() ||
        category.trim() ||
        minMembers.trim() ||
        maxMembers.trim()
    );
  }, [search, category, minMembers, maxMembers]);

  const activeChips = useMemo(() => {
    const chips: string[] = [];
    if (search.trim()) chips.push(`“${search.trim()}”`);
    if (category.trim()) chips.push(`Category: ${category.trim()}`);
    if (minMembers.trim() || maxMembers.trim()) {
      chips.push(`Members: ${minMembers.trim() || "0"}–${maxMembers.trim() || "∞"}`);
    }
    return chips;
  }, [search, category, minMembers, maxMembers]);

  const scrollRail = useCallback((ref: React.RefObject<HTMLDivElement | null>, dir: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.85) * (dir === "left" ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const fetchFeatured = useCallback(async () => {
    const res = await fetch("/api/circles/featured");
    if (res.ok) {
      const data = await res.json();
      setFeatured(data.featured ?? []);
    }
  }, []);

  const fetchTrending = useCallback(async () => {
    const res = await fetch("/api/circles/trending");
    if (res.ok) {
      const data = await res.json();
      setTrending(data.trending ?? []);
    }
  }, []);

  const fetchRecommended = useCallback(async () => {
    const res = await fetch("/api/circles/recommended");
    if (res.ok) {
      const data = await res.json();
      setRecommended(data.recommended ?? []);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/circles/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories ?? []);
    }
  }, []);

  const fetchDirectory = useCallback(
    async (pageNum: number) => {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (search) params.set("q", search);
      if (minMembers.trim()) params.set("min_members", minMembers.trim());
      if (maxMembers.trim()) params.set("max_members", maxMembers.trim());
      params.set("page", String(pageNum));
      params.set("per_page", String(perPage));
      const res = await fetch(`/api/circles/search?${params}`);
      if (res.ok) {
        const data = (await res.json()) as CircleSearchResponse;
        setCircles((data.results ?? []) as unknown as CircleDirectoryItem[]);
        setTotal(data.total ?? 0);
        setPage(data.page ?? 1);

        void fetch("/api/circles/search/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query_text: search,
            filters: {
              category: category || null,
              min_members: minMembers.trim() ? Number(minMembers.trim()) : null,
              max_members: maxMembers.trim() ? Number(maxMembers.trim()) : null,
            },
            result_count: data.total ?? (data.results ?? []).length,
          }),
        }).catch(() => {});
      }
      setLoadingList(false);
    },
    [category, search, minMembers, maxMembers]
  );

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const params = new URLSearchParams();
    params.set("q", q.trim());
    params.set("limit", "8");
    const res = await fetch(`/api/circles/search/suggestions?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as CircleSearchSuggestionsResponse;
    setSuggestions(data.suggestions ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([fetchFeatured(), fetchTrending(), fetchRecommended(), fetchCategories()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchFeatured, fetchTrending, fetchRecommended, fetchCategories]);

  useEffect(() => {
    const tid = setTimeout(() => fetchDirectory(1), 0);
    return () => clearTimeout(tid);
  }, [fetchDirectory]);

  useEffect(() => {
    const tid = setTimeout(() => void fetchSuggestions(searchInput), 200);
    return () => clearTimeout(tid);
  }, [searchInput, fetchSuggestions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setShowSuggestions(false);
    setPage(1);
  };

  const totalPages = Math.ceil(total / perPage) || 1;

  const railCardWrap = (id: string, node: React.ReactNode) => (
    <div key={id} className="min-w-[260px] max-w-xs shrink-0 snap-start">
      {node}
    </div>
  );

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {loading ? (
            <div className="space-y-6" aria-busy="true" aria-label="Loading circle directory">
              <div className="h-40 animate-pulse rounded-2xl bg-muted/60 sm:h-44" />
              <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
              <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
            </div>
          ) : (
            <>
              <header className="rounded-2xl border border-border bg-card px-6 py-9 shadow-sm sm:px-10 sm:py-11">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <div className="mb-3 inline-flex items-center gap-2">
                      <Badge variant="secondary" className="font-normal text-muted-foreground">
                        <Compass className="size-3.5" aria-hidden />
                        Communities
                      </Badge>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                      Discover Circles
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                      Browse communities by topic, or search across circle descriptions and posts.
                    </p>
                  </div>
                </div>
              </header>

              {/* Sticky search & filters */}
              <section className="sticky top-0 z-20 -mx-4 mt-6 sm:-mx-6 lg:-mx-8">
                <div className="border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur-sm sm:rounded-b-2xl sm:border-x sm:px-6 lg:px-8">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
                    <form onSubmit={handleSearchSubmit} className="relative flex w-full flex-col gap-2 sm:flex-row sm:items-stretch lg:max-w-xl lg:flex-1">
                      <div className="relative flex-1">
                        <input
                          type="search"
                          placeholder="Search circles and content…"
                          value={searchInput}
                          onChange={(e) => {
                            setSearchInput(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        />

                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
                            {suggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  void fetch("/api/circles/search/analytics", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      query_text: searchInput,
                                      filters: { type: "suggestion" },
                                      result_count: suggestions.length,
                                      clicked_circle_id: s.id,
                                    }),
                                  }).catch(() => {});
                                  router.push(`/circles/${s.slug}`);
                                }}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                              >
                                <span className="font-medium text-foreground">{s.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {s.category?.name ? `${s.category.name} · ` : ""}
                                  {s.member_count} members
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button type="submit" className="h-10 shrink-0 sm:w-auto">
                        <Search className="h-4 w-4" />
                        Search
                      </Button>
                    </form>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                      <div className="flex flex-col gap-1.5 sm:min-w-[160px]">
                        <label htmlFor="category" className="text-xs font-medium text-muted-foreground">
                          Category
                        </label>
                        <select
                          id="category"
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            setPage(1);
                          }}
                          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          <option value="">All categories</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.slug}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Member count</span>
                        <div className="flex items-center gap-2">
                          <input
                            id="minMembers"
                            inputMode="numeric"
                            placeholder="Min"
                            value={minMembers}
                            onChange={(e) => setMinMembers(e.target.value)}
                            className="h-10 w-[5.5rem] rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          />
                          <span className="text-sm text-muted-foreground">–</span>
                          <input
                            aria-label="Maximum members"
                            inputMode="numeric"
                            placeholder="Max"
                            value={maxMembers}
                            onChange={(e) => setMaxMembers(e.target.value)}
                            className="h-10 w-[5.5rem] rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Discovery rails */}
              {!hasActiveQuery && (
                <div className="mt-10 space-y-8">
                  {recommended.length > 0 && (
                    <DiscoveryRailSection
                      title="Recommended for you"
                      description="Personal picks based on your memberships, or popular circles when you are browsing signed out."
                      railRef={recommendedRef}
                      scrollRail={scrollRail}
                      ariaLeft="Scroll recommended left"
                      ariaRight="Scroll recommended right"
                      accentClass="bg-chart-2"
                    >
                      {recommended.map((c) =>
                        railCardWrap(
                          c.id,
                          <CircleCardComponent
                            title={c.name}
                            category={c.category?.name}
                            members={c.member_count}
                            posts={c.post_count}
                            views={c.total_view_count}
                            upvotes={c.total_like_count}
                            onClick={() => router.push(`/circles/${c.slug}`)}
                          />
                        )
                      )}
                    </DiscoveryRailSection>
                  )}

                  {trending.length > 0 && (
                    <DiscoveryRailSection
                      title="Trending now"
                      description="Circles with strong recent activity and momentum."
                      railRef={trendingRef}
                      scrollRail={scrollRail}
                      ariaLeft="Scroll trending left"
                      ariaRight="Scroll trending right"
                      accentClass="bg-chart-1"
                    >
                      {trending.map((c) =>
                        railCardWrap(
                          c.id,
                          <CircleCardComponent
                            title={c.name}
                            category={c.category?.name}
                            members={c.member_count}
                            posts={c.post_count}
                            views={c.total_view_count}
                            upvotes={c.total_like_count}
                            onClick={() => router.push(`/circles/${c.slug}`)}
                          />
                        )
                      )}
                    </DiscoveryRailSection>
                  )}

                  {featured.length > 0 && (
                    <DiscoveryRailSection
                      title="Featured"
                      description="Curated circles highlighted by the Arches team."
                      railRef={featuredRef}
                      scrollRail={scrollRail}
                      ariaLeft="Scroll featured left"
                      ariaRight="Scroll featured right"
                      accentClass="bg-chart-4"
                    >
                      {featured.map((c) =>
                        railCardWrap(
                          c.id,
                          <CircleCardComponent
                            title={c.name}
                            category={c.category?.name}
                            members={c.member_count}
                            posts={c.post_count}
                            views={c.total_view_count}
                            upvotes={c.total_like_count}
                            onClick={() => router.push(`/circles/${c.slug}`)}
                          />
                        )
                      )}
                    </DiscoveryRailSection>
                  )}
                </div>
              )}

              {/* Browse all / search results */}
              <section className="mt-12 border-t border-border/80 pt-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {hasActiveQuery ? "Search results" : "Browse all circles"}
                    </h2>
                    {hasActiveQuery && activeChips.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeChips.map((chip) => (
                          <Badge key={chip} variant="outline" className="font-normal">
                            {chip}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0 font-normal text-muted-foreground">
                    {loadingList ? "Loading…" : `${total.toLocaleString()} results`}
                  </Badge>
                </div>

                {loadingList ? (
                  <div
                    className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    aria-busy="true"
                    aria-label="Loading circles"
                  >
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[200px] rounded-xl border border-border/80 bg-muted/40 animate-pulse sm:h-[220px]"
                      />
                    ))}
                  </div>
                ) : circles.length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
                    <p className="text-sm font-medium text-foreground">No circles match your filters</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      Try another category, widen the member range, or clear your search.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {circles.map((c) => (
                        <CircleCardComponent
                          key={c.id}
                          variant="compact"
                          title={c.name}
                          description={c.description}
                          category={c.category?.name}
                          members={c.member_count}
                          posts={c.post_count}
                          views={c.total_view_count}
                          upvotes={c.total_like_count}
                          onClick={() => router.push(`/circles/${c.slug}`)}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fetchDirectory(page - 1)}
                          disabled={page <= 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          Page {page} of {totalPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fetchDirectory(page + 1)}
                          disabled={page >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
