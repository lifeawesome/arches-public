/**
 * Issue #138 / #13: Hook for notifying members when a circle is archived or deleted.
 * Replace with real notification pipeline when issue #13 is implemented.
 */
export function notifyCircleLifecycleChange(params: {
  circleId: string;
  action: "archived" | "unarchived" | "deleted";
  actorUserId: string;
  circleName?: string;
}): void {
  if (process.env.NODE_ENV === "development") {
    console.info("[circle lifecycle notify stub]", params);
  }
}
