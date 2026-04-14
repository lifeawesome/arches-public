import Link from "next/link";
import Image from "next/image";
import type { Pathway } from "@/lib/pathways/queries";
import { getPathwayImageUrl } from "@/lib/utils/pathway-image";

interface PathwayCardProps {
  pathway: Pathway;
  onSelect?: (pathwayId: string) => void;
}

export default function PathwayCard({ pathway, onSelect }: PathwayCardProps) {
  const difficultyLabels = [
    "",
    "Beginner",
    "Intermediate",
    "Advanced",
    "Expert",
    "Master",
  ];

  const resolvedImageUrl = getPathwayImageUrl(pathway.cover_image_url);

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border-2 border-border bg-background shadow-md transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-48 w-full overflow-hidden bg-muted">
        <Image
          src={resolvedImageUrl}
          alt={pathway.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          unoptimized={
            resolvedImageUrl.includes("127.0.0.1") ||
            resolvedImageUrl.includes("localhost") ||
            resolvedImageUrl.includes("supabase") ||
            resolvedImageUrl.startsWith("data:")
          }
        />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold">{pathway.title}</h3>
          {pathway.difficulty && (
            <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {difficultyLabels[pathway.difficulty] || `Level ${pathway.difficulty}`}
            </span>
          )}
        </div>
        {pathway.summary && (
          <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
            {pathway.summary}
          </p>
        )}
        {pathway.outcomes && pathway.outcomes.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              You&apos;ll Learn:
            </p>
            <ul className="space-y-1">
              {pathway.outcomes.slice(0, 3).map((outcome, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1 text-primary">•</span>
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            {pathway.estimated_days ? (
              <span>~{pathway.estimated_days} days</span>
            ) : (
              <span>Self-paced</span>
            )}
          </div>
          {onSelect ? (
            <button
              onClick={() => onSelect(pathway.id)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start Pathway
            </button>
          ) : (
            <Link
              href={`/pathways/${pathway.slug}`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              View Details
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

