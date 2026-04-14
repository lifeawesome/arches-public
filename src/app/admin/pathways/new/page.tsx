"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { createClient } from "@/utils/supabase/client";
import { Save } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";

export default function NewPathwayPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    summary: "",
    difficulty: 3,
    estimated_days: 30,
    cover_image_url: "",
    outcomes: [] as string[],
  });
  const [newOutcome, setNewOutcome] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Generate slug from title if not provided
      const slug =
        formData.slug ||
        formData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const { data, error } = await supabase
        .from("pathways")
        .insert({
          title: formData.title,
          slug: slug,
          summary: formData.summary || null,
          difficulty: formData.difficulty,
          estimated_days: formData.estimated_days || null,
          cover_image_url: formData.cover_image_url || null,
          outcomes: formData.outcomes,
          is_active: false, // Start as inactive until content is added
          version: 1,
        })
        .select()
        .single();

      if (error) {
        alert("Failed to create pathway: " + error.message);
        setIsLoading(false);
        return;
      }

      // Redirect to edit page
      router.push(`/admin/pathways/${data.id}`);
    } catch (error) {
      console.error("Error creating pathway:", error);
      alert("Failed to create pathway");
      setIsLoading(false);
    }
  };

  const addOutcome = () => {
    if (newOutcome.trim()) {
      setFormData({
        ...formData,
        outcomes: [...formData.outcomes, newOutcome.trim()],
      });
      setNewOutcome("");
    }
  };

  const removeOutcome = (index: number) => {
    setFormData({
      ...formData,
      outcomes: formData.outcomes.filter((_, i) => i !== index),
    });
  };

  return (
    <AdminLayout>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create New Pathway</h1>
          <p className="text-muted-foreground">
            Start building a new expert growth pathway
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border-2 border-border bg-background p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-2">
                    Pathway Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Personal Branding"
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="slug" className="block text-sm font-medium mb-2">
                    URL Slug (auto-generated if empty)
                  </label>
                  <input
                    id="slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                    placeholder="personal-branding"
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="summary" className="block text-sm font-medium mb-2">
                    Summary
                  </label>
                  <textarea
                    id="summary"
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    placeholder="A brief description of what experts will learn..."
                    rows={3}
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="difficulty" className="block text-sm font-medium mb-2">
                    Difficulty (1-5)
                  </label>
                  <input
                    id="difficulty"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.difficulty}
                    onChange={(e) =>
                      setFormData({ ...formData, difficulty: parseInt(e.target.value) || 3 })
                    }
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="estimated_days" className="block text-sm font-medium mb-2">
                    Estimated Days
                  </label>
                  <input
                    id="estimated_days"
                    type="number"
                    min="1"
                    value={formData.estimated_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimated_days: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Outcomes */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Learning Outcomes</h2>
              <div className="space-y-3">
                {formData.outcomes.map((outcome, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg border-2 border-border bg-muted/30 p-3"
                  >
                    <span className="flex-1 text-sm">{outcome}</span>
                    <button
                      type="button"
                      onClick={() => removeOutcome(index)}
                      className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOutcome();
                      }
                    }}
                    placeholder="Add a learning outcome..."
                    className="flex-1 rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={addOutcome}
                    className="rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Cover Image (optional)
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Upload a cover image for this pathway, or enter a URL manually
              </p>
              <ImageUpload
                bucket="pathway-images"
                currentImageUrl={formData.cover_image_url || undefined}
                onImageUploaded={(url) =>
                  setFormData({ ...formData, cover_image_url: url })
                }
                onImageRemoved={() =>
                  setFormData({ ...formData, cover_image_url: "" })
                }
                maxSizeMB={10}
              />
              <div className="mt-3">
                <label htmlFor="cover_image_url_manual" className="block text-xs text-muted-foreground mb-2">
                  Or enter URL manually:
                </label>
                <input
                  id="cover_image_url_manual"
                  type="url"
                  value={formData.cover_image_url}
                  onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link
              href="/admin/pathways"
              className="rounded-lg border-2 border-border bg-background px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading || !formData.title}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Creating..." : "Create Pathway"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

