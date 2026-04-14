"use client";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { BookOpen, Plus, Settings, Users, TrendingUp, Flag } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage pathways, content, and platform settings
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Pathways</h3>
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Active pathways</p>
          </div>

          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Users</h3>
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Total users</p>
          </div>

          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enrollments</h3>
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Active enrollments</p>
          </div>

          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Tasks</h3>
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Total tasks</p>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/pathways"
            className="group rounded-lg border-2 border-border bg-background p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/50"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Manage Pathways</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Create and edit expert growth pathways, levels, and tasks
            </p>
            <span className="text-sm font-medium text-primary group-hover:underline">
              Open Pathways Manager →
            </span>
          </Link>

          <Link
            href="/admin/pathways/new"
            className="group rounded-lg border-2 border-dashed border-border bg-background p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Create New Pathway</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Build a new expert growth pathway from scratch
            </p>
            <span className="text-sm font-medium text-primary group-hover:underline">
              Start Building →
            </span>
          </Link>

          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Settings</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Platform configuration and preferences
            </p>
            <span className="text-sm font-medium text-muted-foreground">
              Coming soon
            </span>
          </div>
        </div>

        {/* Recent Activity or Quick Links */}
        <div className="mt-8 rounded-lg border-2 border-border bg-background p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/admin/platform-reports"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Flag className="h-4 w-4" />
              Platform reports (circles)
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-primary hover:underline"
            >
              View User Dashboard
            </Link>
            <Link href="/pricing" className="text-sm text-primary hover:underline">
              View Pricing Page
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

