"use client";

import { useState } from "react";
import PathwayCard from "./PathwayCard";
import type { Pathway } from "@/lib/pathways/queries";

interface PathwayListProps {
  pathways: Pathway[];
  onSelectPathway?: (pathwayId: string) => void;
  isLoading?: boolean;
}

export default function PathwayList({
  pathways,
  onSelectPathway,
  isLoading,
}: PathwayListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-lg border-2 border-border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (pathways.length === 0) {
    return (
      <div className="rounded-lg border-2 border-border bg-muted/30 p-12 text-center">
        <h3 className="mb-2 text-lg font-semibold">No pathways available</h3>
        <p className="text-sm text-muted-foreground">
          Check back soon for new expert growth pathways.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {pathways.map((pathway) => (
        <PathwayCard
          key={pathway.id}
          pathway={pathway}
          onSelect={onSelectPathway}
        />
      ))}
    </div>
  );
}

