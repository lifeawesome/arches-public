"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { enrollInPathway } from "@/lib/pathways/queries";

interface EnrollButtonProps {
  pathwayId: string;
  userId: string;
}

export default function EnrollButton({
  pathwayId,
  userId,
}: EnrollButtonProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isEnrolling, setIsEnrolling] = useState(false);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      await enrollInPathway(supabase, userId, pathwayId, true);
      router.refresh();
    } catch (error: any) {
      alert(`Failed to enroll: ${error.message}`);
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <button
      onClick={handleEnroll}
      disabled={isEnrolling}
      className="rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isEnrolling ? "Enrolling..." : "Start Pathway"}
    </button>
  );
}

