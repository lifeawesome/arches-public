"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatCompactNumber, formatExactCount } from "@/lib/utils/format-compact-number";
import { ChevronRight, Eye, MessageSquare, ThumbsUp, Users } from "lucide-react";

export type RingSegment = {
    value: number;
    color?: string;
};

export type ArchesCircleCardProps = {
    /**
     * `ring` = featured rail card (default). Name kept for compatibility with existing callers.
     * `compact` = dense grid card.
     */
    variant?: "ring" | "compact";

    title: string;
    subtitle?: string;
    description?: string | null;

    category?: string;
    badgeText?: string;

    /** Ignored in the current layout; kept for API compatibility. */
    size?: number;
    outerStroke?: number;
    innerStroke?: number;
    ringGap?: number;

    members?: number;
    posts?: number;
    views?: number;
    upvotes?: number;

    outerSegments?: RingSegment[];
    innerProgress?: number;
    statusLabel?: string;
    joinable?: boolean;

    onClick?: () => void;
    className?: string;
};

const ACCENT_SWATCHES = [
    "from-chart-1/90 to-chart-1/40",
    "from-chart-2/90 to-chart-2/40",
    "from-chart-3/90 to-chart-3/40",
    "from-chart-4/90 to-chart-4/40",
    "from-chart-5/90 to-chart-5/40",
] as const;

const ACCENT_SOLID = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const;

function accentIndex(title: string): number {
    let h = 0;
    for (let i = 0; i < title.length; i++) {
        h = title.charCodeAt(i) + ((h << 5) - h);
    }
    return Math.abs(h) % ACCENT_SWATCHES.length;
}

function clamp01(n: number) {
    return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function activateCardClick(
    e: React.KeyboardEvent,
    onClick: (() => void) | undefined,
    clickable: boolean
) {
    if (!clickable || !onClick) return;
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
    }
}

function deriveHealth(posts: number, members: number, views: number, innerProgress?: number) {
    const m = clamp01(posts / 12);
    const c = clamp01(members / 40);
    const v = clamp01(views / 600);
    const derived = clamp01(m * 0.5 + v * 0.3 + c * 0.2);
    return innerProgress === undefined ? derived : clamp01(innerProgress);
}

function deriveStatus(
    members: number,
    posts: number,
    views: number,
    health: number,
    statusLabel?: string
) {
    if (statusLabel) return statusLabel;
    if (members === 0 && posts === 0 && views === 0) return "New";
    if (health < 0.25) return "Warming up";
    if (health < 0.55) return "Growing";
    if (health < 0.8) return "Active";
    return "Thriving";
}

function letterFromTitle(title: string) {
    const t = title.trim();
    if (!t) return "?";
    const ch = t[0];
    return /[a-z]/i.test(ch) ? ch.toUpperCase() : "#";
}

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

/** Round lettermark + circular activity ring so the card reads as a “circle”. */
function CircleEmblem({
    letter,
    solidClass,
    activityPct,
    size = "md",
}: {
    letter: string;
    solidClass: string;
    activityPct: number;
    size?: "sm" | "md";
}) {
    const pct = clamp01(activityPct / 100);
    const dash = pct * RING_C;
    const dim = size === "md" ? "h-[4.75rem] w-[4.75rem]" : "h-[3.25rem] w-[3.25rem]";
    const inner =
        size === "md"
            ? "size-[3.35rem] text-2xl tracking-tight shadow-md ring-4 ring-card"
            : "size-10 text-lg shadow-sm ring-2 ring-card";

    return (
        <div className={cn("relative shrink-0", dim)} aria-hidden>
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" fill="none" aria-hidden>
                <circle cx="50" cy="50" r={RING_R} className="stroke-border" strokeWidth="5" opacity={0.45} />
                <circle
                    cx="50"
                    cy="50"
                    r={RING_R}
                    className="stroke-foreground"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${RING_C}`}
                    opacity={0.85}
                />
            </svg>
            <div
                className={cn(
                    "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-bold text-primary-foreground",
                    solidClass,
                    inner
                )}
            >
                {letter}
            </div>
        </div>
    );
}

type StatCellProps = {
    icon: React.ElementType;
    label: string;
    value: number;
    className?: string;
};

function StatCell({ icon: Icon, label, value, className }: StatCellProps) {
    const exact = formatExactCount(value);
    const compact = formatCompactNumber(value);
    return (
        <div
            className={cn(
                "flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 shadow-xs",
                className
            )}
        >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="truncate text-sm font-semibold tabular-nums text-foreground" title={exact}>
                    {compact}
                </p>
            </div>
        </div>
    );
}

export default function ArchesCircleCard({
    variant = "ring",
    title,
    subtitle = "",
    description,
    category = "",
    badgeText = "Public Circle",
    members = 0,
    posts = 0,
    views = 0,
    upvotes = 0,
    innerProgress,
    statusLabel,
    joinable = true,
    onClick,
    className = "",
}: ArchesCircleCardProps) {
    const id = React.useId();
    const statsId = `${id}-stats`;
    const clickable = Boolean(onClick);
    const openLabel = joinable ? `Join circle: ${title}` : `View circle: ${title}`;
    const cta = joinable ? "Join circle" : "View circle";

    const ai = accentIndex(title);
    const gradientClass = ACCENT_SWATCHES[ai];
    const solidClass = ACCENT_SOLID[ai];
    const health = deriveHealth(posts, members, views, innerProgress);
    const activityPct = Math.round(health * 100);
    const status = deriveStatus(members, posts, views, health, statusLabel);

    if (variant === "compact") {
        return (
            <div
                className={cn(
                    "group/card relative w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md",
                    clickable &&
                        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    className
                )}
                onClick={onClick}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={(e) => activateCardClick(e, onClick, clickable)}
                aria-label={clickable ? openLabel : undefined}
                aria-describedby={clickable ? statsId : undefined}
            >
                <div className={cn("absolute inset-y-0 left-0 w-1 rounded-l-xl", solidClass)} aria-hidden />
                <div className="relative p-4 pl-5">
                    <div className="flex gap-3">
                        <CircleEmblem
                            letter={letterFromTitle(title)}
                            solidClass={solidClass}
                            activityPct={activityPct}
                            size="sm"
                        />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold leading-snug text-foreground line-clamp-2">{title}</h3>
                            {(category || badgeText) && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {[category, badgeText].filter(Boolean).join(" · ")}
                                </p>
                            )}
                        </div>
                    </div>
                    {description?.trim() ? (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">{description.trim()}</p>
                    ) : null}
                    {!description?.trim() && subtitle ? (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{subtitle}</p>
                    ) : null}
                    <p id={statsId} className="sr-only">
                        {formatExactCount(posts)} posts, {formatExactCount(members)} members, {formatExactCount(views)}{" "}
                        views, {formatExactCount(upvotes)} upvotes. Status {status}, activity {activityPct} percent.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <StatCell icon={MessageSquare} label="Posts" value={posts} className="py-1.5" />
                        <StatCell icon={Users} label="Members" value={members} className="py-1.5" />
                        <StatCell icon={Eye} label="Views" value={views} className="py-1.5" />
                        <StatCell icon={ThumbsUp} label="Upvotes" value={upvotes} className="py-1.5" />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                        <span className="text-[11px] font-medium text-muted-foreground">
                            {status} · {activityPct}% activity
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-sm font-medium text-primary transition-transform group-hover/card:translate-x-0.5">
                            {cta}
                            <ChevronRight className="size-4" aria-hidden />
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    /* Featured rail card (variant default / legacy name "ring") */
    return (
        <div
            className={cn(
                "group/card relative w-full min-w-[260px] max-w-[300px] overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-shadow hover:shadow-lg",
                clickable &&
                    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                className
            )}
            onClick={onClick}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={(e) => activateCardClick(e, onClick, clickable)}
            aria-label={clickable ? openLabel : undefined}
            aria-describedby={clickable ? statsId : undefined}
        >
            <div className={cn("relative h-28 overflow-hidden bg-gradient-to-br", gradientClass)} aria-hidden>
                <div
                    className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border-2 border-primary-foreground/15"
                    aria-hidden
                />
            </div>

            <div className="relative -mt-[2.35rem] ml-3 sm:ml-4">
                <CircleEmblem
                    letter={letterFromTitle(title)}
                    solidClass={solidClass}
                    activityPct={activityPct}
                    size="md"
                />
            </div>

            <div className="relative px-4 pb-4 pt-3">
                <h3 className="pr-1 text-lg font-semibold leading-tight tracking-tight text-foreground line-clamp-2">
                    {title}
                </h3>
                {(category || badgeText) && (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        {[category, badgeText].filter(Boolean).join(" · ")}
                    </p>
                )}
                {subtitle ? (
                    <p className="mt-2 text-sm leading-snug text-muted-foreground line-clamp-2">{subtitle}</p>
                ) : null}

                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span className="text-foreground">{status}</span>
                    <span className="text-border">|</span>
                    <span>{activityPct}% activity</span>
                </div>

                <p id={statsId} className="sr-only">
                    {formatExactCount(posts)} posts, {formatExactCount(members)} members, {formatExactCount(views)} views,{" "}
                    {formatExactCount(upvotes)} upvotes. Status {status}, activity {activityPct} percent.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <StatCell icon={MessageSquare} label="Posts" value={posts} />
                    <StatCell icon={Users} label="Members" value={members} />
                    <StatCell icon={Eye} label="Views" value={views} />
                    <StatCell icon={ThumbsUp} label="Upvotes" value={upvotes} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4">
                    <span className="text-xs text-muted-foreground">Open to explore</span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform group-hover/card:gap-2">
                        {cta}
                        <ChevronRight className="size-4 shrink-0" aria-hidden />
                    </span>
                </div>
            </div>
        </div>
    );
}
