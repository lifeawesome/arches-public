"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { User, Bell, Shield, LogOut, Upload, Loader2, X } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/utils/supabase/client";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { clearAllSessionData } from "@/utils/auth/clear-session";
import { getAvatarUrl } from "@/lib/utils/avatar";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) return;

        setUser(authUser);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setProfile(profileData);
        setUsernameDraft((profileData?.username as string | undefined) ?? "");
        if (profileData?.avatar_url) {
          setAvatarUrl(getAvatarUrl(profileData.avatar_url));
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const acceptedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!acceptedTypes.includes(file.type)) {
      alert("Please upload an image file (JPEG, PNG, GIF, or WEBP)");
      return;
    }

    // Validate file size (5MB limit for avatars)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to upload avatars");
      }

      // Delete old avatar if it exists and is in Supabase storage
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url;
        // Only delete if it's a storage path (not a full URL like OAuth or DiceBear)
        if (!oldPath.startsWith("http") && !oldPath.startsWith("blob:")) {
          try {
            await supabase.storage.from("avatars").remove([oldPath]);
          } catch (error) {
            // Ignore errors when deleting old avatar
            console.warn("Could not delete old avatar:", error);
          }
        }
      }

      // Create unique filename using user ID
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Update profile with the storage path (not full URL) for consistency
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: uploadData.path })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setAvatarUrl(getAvatarUrl(uploadData.path));
      
      // Refresh profile data
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    } catch (err) {
      console.error("Error uploading avatar:", err);
      alert(
        err instanceof Error ? err.message : "Failed to upload avatar. Please try again."
      );
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSaveUsername = async () => {
    setUsernameMessage(null);
    setUsernameSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameDraft.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUsernameMessage((data as { error?: string }).error ?? "Could not save username.");
        return;
      }
      setUsernameMessage("Username saved.");
      if (user?.id) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (p) setProfile(p);
      }
    } catch {
      setUsernameMessage("Could not save username.");
    } finally {
      setUsernameSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url) return;

    try {
      const oldPath = profile.avatar_url;
      // Only delete if it's a storage path (not a full URL like OAuth or DiceBear)
      if (!oldPath.startsWith("http") && !oldPath.startsWith("blob:")) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      // Update profile to remove avatar
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setAvatarUrl(null);
      
      // Refresh profile data
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    } catch (err) {
      console.error("Error removing avatar:", err);
      alert("Failed to remove avatar. Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear impersonation cookies if present (in case user is impersonating)
      const clearCookie = (name: string) => {
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
      };
      clearCookie("impersonated_user_id");
      clearCookie("original_admin_id");
      clearCookie("admin_session_backup");
      
      // Clear localStorage too
      try {
        localStorage.removeItem("admin_session_backup");
      } catch (e) {
        // Ignore errors
      }

      // Sign out from Supabase (clears server-side session)
      await supabase.auth.signOut();

      // Explicitly clear all client-side session data including cookies
      clearAllSessionData();

      // Force a hard redirect to login page to ensure everything is cleared
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
      // Even if signOut fails, clear session data and redirect
      clearAllSessionData();
      window.location.href = "/login";
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account and preferences.
            </p>
          </div>

          {/* Profile Section */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Profile</h2>
            </div>
            <div className="space-y-4">
              {/* Avatar Upload */}
              <div>
                <label className="mb-2 block text-sm font-medium">Profile Picture</label>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-border">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={profile?.full_name || "Profile"}
                        fill
                        className="object-cover"
                        unoptimized={avatarUrl.includes("127.0.0.1") || avatarUrl.includes("localhost") || avatarUrl.includes("supabase")}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-2xl font-medium text-muted-foreground">
                        {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <button
                      type="button"
                      onClick={handleUploadClick}
                      disabled={isUploading}
                      className="flex items-center justify-center gap-2 rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Upload Avatar</span>
                        </>
                      )}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={isUploading}
                        className="flex items-center justify-center gap-2 rounded-lg border-2 border-destructive/50 bg-background px-4 py-2 text-sm font-medium text-destructive transition-colors hover:border-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="h-4 w-4" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  JPEG, PNG, GIF, or WEBP. Max 5MB.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-lg border-2 border-border bg-muted px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  value={profile?.full_name || ""}
                  disabled
                  className="w-full rounded-lg border-2 border-border bg-muted px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Username (for @mentions in Circles)</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    placeholder="e.g. jane_dev"
                    maxLength={30}
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveUsername()}
                    disabled={usernameSaving}
                    className="shrink-0 rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {usernameSaving ? "Saving…" : "Save username"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  3–30 characters: letters, numbers, underscores. Unique across the app. Leave empty to clear.
                </p>
                {usernameMessage ? (
                  <p className="mt-1 text-xs text-muted-foreground">{usernameMessage}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tour Section */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Onboarding</h2>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reset the dashboard tour to see it again.
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem("arches_dashboard_tour_completed");
                  alert("Tour reset! Refresh the page and visit the dashboard to see it again.");
                }}
                className="rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Reset Dashboard Tour
              </button>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>
            <NotificationSettings />
          </div>

          {/* Account Section */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Account</h2>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-destructive bg-background px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

