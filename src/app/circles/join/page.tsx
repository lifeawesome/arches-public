import { Suspense } from "react";
import CircleJoinClient from "./CircleJoinClient";

export default function CircleJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-4 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <CircleJoinClient />
    </Suspense>
  );
}
