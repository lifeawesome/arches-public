import { NextResponse } from "next/server";
import { isBlockedFromCircle } from "@/lib/utils/circles/access-control";

/** Returned in JSON when the current user is on the circle block list. */
export const CIRCLE_BLOCKED_ERROR_CODE = "circle_blocked" as const;

/**
 * 403 response for circle routes when canAccessCircle is false.
 * Adds `code: "circle_blocked"` when the signed-in user is explicitly blocked.
 */
export async function jsonCircleAccessForbidden(
  circleId: string,
  userId: string | null | undefined
): Promise<NextResponse> {
  const blocked = !!userId && (await isBlockedFromCircle(circleId, userId));
  return NextResponse.json(
    {
      error: blocked
        ? "You have been blocked from this circle by the owner or a moderator."
        : "You do not have access to this circle",
      ...(blocked ? { code: CIRCLE_BLOCKED_ERROR_CODE } : {}),
    },
    { status: 403 }
  );
}
