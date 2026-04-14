"use client";

import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  bucket: string;
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved?: () => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

export function ImageUpload({
  bucket,
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  maxSizeMB = 10,
  acceptedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentImageUrl || null
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      setError(`Please upload an image file (${acceptedTypes.map(t => t.split('/')[1]).join(', ').toUpperCase()})`);
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`Image must be less than ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);

    try {
      // Get current user ID for folder structure
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to upload images");
      }

      // Create unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `pathways/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(data.path);

      setPreviewUrl(publicUrl);
      onImageUploaded(publicUrl);
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(
        err instanceof Error ? err.message : "Failed to upload image"
      );
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onImageRemoved) {
      onImageRemoved();
    }
  };

  return (
    <div className="space-y-3">
      {previewUrl ? (
        <div className="relative group">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-border bg-muted/30">
            <img
              src={previewUrl}
              alt="Preview"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-2 top-2 rounded-full bg-destructive/90 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 transition-colors ${
            uploading ? "cursor-wait opacity-50" : "hover:border-primary hover:bg-primary/5"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(",")}
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <>
              <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Click to upload an image
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {acceptedTypes.map(t => t.split('/')[1]).join(', ').toUpperCase()} up to {maxSizeMB}MB
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {previewUrl && !uploading && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
        >
          <Upload className="mr-2 inline h-4 w-4" />
          Replace Image
        </button>
      )}
    </div>
  );
}

