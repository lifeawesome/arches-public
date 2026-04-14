"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, XCircle } from "lucide-react";

type CircleInfo = { id: string; name: string; slug: string };

type State = "loading" | "needs_auth" | "ready" | "accepting" | "accepted" | "error";

export default function CircleJoinClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("loading");
  const [circle, setCircle] = useState<CircleInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (!token?.trim()) {
      setState("error");
      setErrorMessage("Missing invitation token");
      return;
    }

    let cancelled = false;
    fetch(`/api/circles/join/accept?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/circles/join?token=${token}`)}`);
          return;
        }
        const data = await res.json();
        if (data.error) {
          setState("error");
          setErrorMessage(data.error);
          return;
        }
        if (data.circle) {
          setCircle(data.circle);
        }
        if (data.accepted) {
          setState("accepted");
          const slug = data.circle?.slug;
          router.replace(slug ? `/circles/${slug}` : "/dashboard");
          return;
        }
        setState("needs_auth");
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
          setErrorMessage("Something went wrong");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const handleAccept = async () => {
    if (!token) return;
    setState("accepting");
    try {
      const res = await fetch("/api/circles/join/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/circles/join?token=${token}`)}`);
          return;
        }
        setState("error");
        setErrorMessage(data.error ?? "Failed to accept invitation");
        return;
      }
      const slug = data.circle?.slug;
      setState("accepted");
      router.replace(slug ? `/circles/${slug}` : "/dashboard");
    } catch {
      setState("error");
      setErrorMessage("Failed to accept invitation");
    }
  };

  const handleReject = async () => {
    if (!token) {
      router.replace("/dashboard");
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch("/api/circles/join/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/circles/join?token=${token}`)}`);
          return;
        }
        setState("error");
        setErrorMessage(data.error ?? "Failed to reject invitation");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setState("error");
      setErrorMessage("Failed to reject invitation");
    } finally {
      setRejecting(false);
    }
  };

  if (state === "loading" || state === "accepting" || state === "accepted") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {state === "accepted" && <span className="sr-only">Redirecting…</span>}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-md p-4">
        <Card>
          <CardHeader>
            <CardTitle>Invalid invitation</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <Card>
        <CardHeader>
          <CardTitle>Join {circle?.name ?? "the circle"}</CardTitle>
          <CardDescription>
            Review the circle, then accept or reject this invitation. You can always ignore the invitation if you
            don&apos;t want to join.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="mt-2 space-y-2 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              You are signed in with the invited account. You can accept or reject this invitation:
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleAccept}>
                <Check className="mr-2 h-4 w-4" />
                Accept invitation
              </Button>
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={handleReject}
                disabled={rejecting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {rejecting ? "Rejecting..." : "Reject invitation"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

