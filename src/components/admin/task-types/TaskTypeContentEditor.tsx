"use client";

import { ReadTextEditor } from "./ReadTextEditor";
import { WatchVideoEditor } from "./WatchVideoEditor";
import { TakeQuizEditor } from "./TakeQuizEditor";
import { FollowGuideEditor } from "./FollowGuideEditor";
import { ScavengerHuntEditor } from "./ScavengerHuntEditor";
import { ReadQuoteEditor } from "./ReadQuoteEditor";
import { CreateContentEditor } from "./CreateContentEditor";
import { RefineContentEditor } from "./RefineContentEditor";
import { PublishContentEditor } from "./PublishContentEditor";
import { PracticeSkillEditor } from "./PracticeSkillEditor";
import { ReviewWorkEditor } from "./ReviewWorkEditor";
import { ConnectWithEditor } from "./ConnectWithEditor";
import type { TaskTypeContentEditorProps } from "./utils";

/**
 * Registry component that maps task type slugs to their specific editor components
 */
export function TaskTypeContentEditor({
  taskTypeSlug,
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps & { taskTypeSlug: string }) {
  const editorProps = { content, schema, onChange };

  switch (taskTypeSlug) {
    case "read-text":
      return <ReadTextEditor {...editorProps} />;
    case "watch-video":
      return <WatchVideoEditor {...editorProps} />;
    case "take-quiz":
      return <TakeQuizEditor {...editorProps} />;
    case "follow-guide":
      return <FollowGuideEditor {...editorProps} />;
    case "scavenger-hunt":
      return <ScavengerHuntEditor {...editorProps} />;
    case "read-quote":
      return <ReadQuoteEditor {...editorProps} />;
    case "create-content":
      return <CreateContentEditor {...editorProps} />;
    case "refine-content":
      return <RefineContentEditor {...editorProps} />;
    case "publish-content":
      return <PublishContentEditor {...editorProps} />;
    case "practice-skill":
      return <PracticeSkillEditor {...editorProps} />;
    case "review-work":
      return <ReviewWorkEditor {...editorProps} />;
    case "connect-with":
      return <ConnectWithEditor {...editorProps} />;
    default:
      return (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Unknown task type: {taskTypeSlug}
        </div>
      );
  }
}



