"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Users, ExternalLink, Crown, BarChart3 } from "lucide-react";

type CircleVisibility = "public" | "private";
type CircleMemberRole = "member" | "contributor" | "moderator";

type CircleMini = {
  id: string;
  expert_id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: CircleVisibility;
  is_active: boolean;
  member_count: number;
  is_featured: boolean;
  category?: { id: string; name: string; slug: string } | null;
};

type MemberOfRow = {
  circle: CircleMini;
  membership: { membership_id: string; role: CircleMemberRole; joined_at: string };
};

export default function DashboardCirclesPage() {
  const [owned, setOwned] = useState<CircleMini[]>([]);
  const [memberOf, setMemberOf] = useState<MemberOfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/circles/mine")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Failed to load circles");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setOwned(data?.owned ?? []);
        setMemberOf(data?.member_of ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibilityBadge = (v: CircleVisibility) => (
    <Badge variant={v === "public" ? "default" : "secondary"}>
      {v === "public" ? "Public" : "Private"}
    </Badge>
  );

  const roleBadge = (role: CircleMemberRole) => {
    const label = role === "moderator" ? "Moderator" : role === "contributor" ? "Contributor" : "Member";
    const variant = role === "moderator" ? "default" : "secondary";
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Circles</h1>
            <p className="text-sm text-muted-foreground">
              Manage circles you own, and see circles you’re a member of.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/circles/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Circle
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <Tabs defaultValue="owned" className="w-full">
            <TabsList>
              <TabsTrigger value="owned">
                <Crown className="h-4 w-4" />
                Owned ({owned.length})
              </TabsTrigger>
              <TabsTrigger value="member-of">
                <Users className="h-4 w-4" />
                Member of ({memberOf.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="owned" className="mt-4">
              {owned.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No owned circles yet</CardTitle>
                    <CardDescription>
                      Create your first circle to start building your community.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild>
                      <Link href="/dashboard/circles/new">Create Circle</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {owned.map((c) => (
                    <Card key={c.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="truncate">{c.name}</CardTitle>
                            {c.description && (
                              <CardDescription className="line-clamp-2">
                                {c.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {visibilityBadge(c.visibility)}
                            {c.is_featured && <Badge variant="outline">Featured</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{c.member_count} members</span>
                          {c.category?.name && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <span>{c.category.name}</span>
                            </>
                          )}
                          {!c.is_active && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <Badge variant="outline">Inactive</Badge>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/circles/${c.id}/edit`}>
                              <Settings className="mr-2 h-4 w-4" />
                              Settings
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/circles/${c.id}/members`}>
                              <Users className="mr-2 h-4 w-4" />
                              Members
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/circles/${c.id}/analytics`}>
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Analytics
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/circles/${c.slug}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open circle
                            </Link>
                          </Button>
                          {c.visibility === "public" && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/circles/${c.slug}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Public page
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="member-of" className="mt-4">
              {memberOf.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No memberships yet</CardTitle>
                    <CardDescription>
                      Join a circle to see it here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" asChild>
                      <Link href="/circles">Browse Circle Directory</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {memberOf.map(({ circle: c, membership }) => (
                    <Card key={membership.membership_id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="truncate">{c.name}</CardTitle>
                            {c.description && (
                              <CardDescription className="line-clamp-2">
                                {c.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {roleBadge(membership.role)}
                            {visibilityBadge(c.visibility)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{c.member_count} members</span>
                          {c.category?.name && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <span>{c.category.name}</span>
                            </>
                          )}
                          {!c.is_active && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <Badge variant="outline">Inactive</Badge>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/circles/${c.id}/members`}>
                              <Users className="mr-2 h-4 w-4" />
                              Members
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/circles/${c.slug}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open circle
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

