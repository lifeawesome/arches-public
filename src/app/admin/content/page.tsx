"use client";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { FileText } from "lucide-react";

export default function ContentPage() {
  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Content</h1>
          </div>
          <p className="text-muted-foreground">
            Manage blog posts, pages, and other content
          </p>
        </div>

        <div className="rounded-lg border-2 border-border bg-background p-8 text-center">
          <p className="text-muted-foreground">Content management coming soon...</p>
        </div>
      </div>
    </AdminLayout>
  );
}



