import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getPathwayBySlug, getPathwayProgress } from "@/lib/pathways/queries";
import { getLevels } from "@/lib/admin/level-task-queries";
import { getTasks } from "@/lib/admin/level-task-queries";
import PathwayPath from "@/components/pathways/PathwayPath";
import EnrollButton from "@/components/pathways/EnrollButton";
import { getUser } from "@/utils/supabase/queries";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getPathwayImageUrl } from "@/lib/utils/pathway-image.server";

interface PathwayPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PathwayPage({ params }: PathwayPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const user = await getUser(supabase);

  // Redirect to login if not authenticated
  if (!user) {
    redirect(`/login?redirect=/pathways/${slug}`);
  }

  // Fetch pathway
  const pathway = await getPathwayBySlug(supabase, slug);
  if (!pathway) {
    notFound();
  }

  // Fetch levels
  const levels = await getLevels(supabase, pathway.id);

  // Fetch tasks for each level and get progress
  const levelsWithTasks = await Promise.all(
    levels.map(async (level) => {
      const tasks = await getTasks(supabase, level.id);
      return { ...level, tasks };
    })
  );

  // Get user progress
  const progress = await getPathwayProgress(supabase, user.id, pathway.id);

  // Check if user is enrolled
  const { data: enrollment } = await supabase
    .from("user_pathways")
    .select("id")
    .eq("user_id", user.id)
    .eq("pathway_id", pathway.id)
    .single();

  const isEnrolled = !!enrollment;
  const resolvedImageUrl = await getPathwayImageUrl(pathway.cover_image_url);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* Pathway Header */}
        <div className="relative border-b border-border bg-muted/30">
        <div className="relative h-64 w-full overflow-hidden">
          <Image
            src={resolvedImageUrl}
            alt={pathway.title}
            fill
            className="object-cover"
            unoptimized={
              resolvedImageUrl.includes("127.0.0.1") ||
              resolvedImageUrl.includes("localhost") ||
              resolvedImageUrl.includes("supabase") ||
              resolvedImageUrl.startsWith("data:")
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl">
            <Link
              href="/dashboard/paths"
              className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Pathways
            </Link>
            <h1 className="mb-4 text-4xl font-bold">{pathway.title}</h1>
            {pathway.summary && (
              <p className="mb-6 text-lg text-muted-foreground">
                {pathway.summary}
              </p>
            )}
            {pathway.outcomes && pathway.outcomes.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  You&apos;ll Learn:
                </h2>
                <ul className="space-y-1">
                  {pathway.outcomes.map((outcome, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 text-primary">•</span>
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {pathway.estimated_days && (
                <span>~{pathway.estimated_days} days</span>
              )}
              <span>•</span>
              <span>Difficulty: {pathway.difficulty}/5</span>
            </div>
            {!isEnrolled && (
              <div className="mt-6">
                <EnrollButton userId={user.id} pathwayId={pathway.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pathway Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl">
          {levelsWithTasks.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
              <p className="text-muted-foreground">
                This pathway is still being created. Check back soon!
              </p>
            </div>
          ) : (
            <PathwayPath
              levels={levelsWithTasks}
              completedTaskIds={progress.completedTaskIds}
              levelProgress={progress.levelProgress}
            />
          )}
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}


