"use client";

import { useEffect, useState } from "react";
import { Mail, Bell, Smartphone, Megaphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnifiedNotificationSettings, EmailFrequency } from "@/types/notifications";
import { useToast } from "@/components/ui/Toasts/use-toast";

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<UnifiedNotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch("/api/user/notifications");
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Failed to fetch preferences:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          throw new Error(
            errorData.error || `Failed to fetch preferences (${response.status})`
          );
        }
        const data = await response.json();
        setPreferences(data.preferences);
      } catch (error) {
        console.error("Error fetching notification preferences:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to load notification preferences. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [toast]);

  // Update preference
  const updatePreference = async (
    updates: Partial<UnifiedNotificationSettings>
  ) => {
    if (!preferences) return;

    // Optimistic update
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    setIsSaving(true);

    try {
      const response = await fetch("/api/user/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update preferences");
      }

      const data = await response.json();
      setPreferences(data.preferences);
      toast({
        title: "Success",
        description: "Notification preferences updated.",
      });
    } catch (error) {
      console.error("Error updating preferences:", error);
      // Revert optimistic update
      setPreferences(preferences);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Master toggle handlers
  const handleEmailMasterToggle = (enabled: boolean) => {
    updatePreference({
      email_direct_messages: enabled,
      email_project_requests: enabled,
      email_system_notifications: enabled,
    });
  };

  const handleMarketingMasterToggle = (enabled: boolean) => {
    updatePreference({
      newsletter_subscribed: enabled,
      product_updates_subscribed: enabled,
      event_invitations_subscribed: enabled,
      success_stories_subscribed: enabled,
      partner_offers_subscribed: enabled,
    });
  };

  // Check if email notifications are all enabled
  const emailNotificationsEnabled =
    preferences?.email_direct_messages &&
    preferences?.email_project_requests &&
    preferences?.email_system_notifications;

  // Check if marketing notifications are all enabled
  const marketingNotificationsEnabled =
    preferences?.newsletter_subscribed &&
    preferences?.product_updates_subscribed &&
    preferences?.event_invitations_subscribed &&
    preferences?.success_stories_subscribed &&
    preferences?.partner_offers_subscribed;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Unable to load notification preferences. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Email Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="email-master" className="text-sm">
              Enable all
            </Label>
            <Switch
              id="email-master"
              checked={emailNotificationsEnabled}
              onCheckedChange={handleEmailMasterToggle}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-3 pl-7">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-direct-messages" className="text-sm font-normal">
              Direct messages
            </Label>
            <Switch
              id="email-direct-messages"
              checked={preferences.email_direct_messages}
              onCheckedChange={(checked) =>
                updatePreference({ email_direct_messages: checked })
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email-project-requests" className="text-sm font-normal">
              Project requests
            </Label>
            <Switch
              id="email-project-requests"
              checked={preferences.email_project_requests}
              onCheckedChange={(checked) =>
                updatePreference({ email_project_requests: checked })
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email-system" className="text-sm font-normal">
              System notifications
            </Label>
            <Switch
              id="email-system"
              checked={preferences.email_system_notifications}
              onCheckedChange={(checked) =>
                updatePreference({ email_system_notifications: checked })
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="email-frequency" className="text-sm font-normal">
              Email frequency
            </Label>
            <Select
              value={preferences.email_frequency}
              onValueChange={(value: EmailFrequency) =>
                updatePreference({ email_frequency: value })
              }
              disabled={isSaving}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="hourly">Hourly digest</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Push Notifications</h3>
          </div>
          <Switch
            checked={preferences.push_notifications}
            onCheckedChange={(checked) =>
              updatePreference({ push_notifications: checked })
            }
            disabled={isSaving}
          />
        </div>
        <p className="pl-7 text-xs text-muted-foreground">
          Receive push notifications in your browser. You may need to allow
          notifications in your browser settings.
        </p>
      </div>

      {/* In-App Notifications Section */}
      <div className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">In-App Notifications</h3>
          </div>
          <Switch
            checked={preferences.in_app_notifications}
            onCheckedChange={(checked) =>
              updatePreference({ in_app_notifications: checked })
            }
            disabled={isSaving}
          />
        </div>
        <p className="pl-7 text-xs text-muted-foreground">
          Show notifications within the app. Critical updates will always be
          shown regardless of this setting.
        </p>
      </div>

      {/* Marketing Notifications Section */}
      <div className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Marketing Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="marketing-master" className="text-sm">
              Enable all
            </Label>
            <Switch
              id="marketing-master"
              checked={marketingNotificationsEnabled}
              onCheckedChange={handleMarketingMasterToggle}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-3 pl-7">
          <div className="flex items-center justify-between">
            <Label htmlFor="newsletter" className="text-sm font-normal">
              Newsletter
            </Label>
            <Switch
              id="newsletter"
              checked={preferences.newsletter_subscribed}
              onCheckedChange={(checked) =>
                updatePreference({ newsletter_subscribed: checked })
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="product-updates" className="text-sm font-normal">
              Product updates
            </Label>
            <Switch
              id="product-updates"
              checked={preferences.product_updates_subscribed}
              onCheckedChange={(checked) =>
                updatePreference({ product_updates_subscribed: checked })
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="event-invitations" className="text-sm font-normal">
              Event invitations
            </Label>
            <Switch
              id="event-invitations"
              checked={preferences.event_invitations_subscribed}
              onCheckedChange={(checked) =>
                updatePreference({ event_invitations_subscribed: checked })
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="success-stories" className="text-sm font-normal">
              Success stories
            </Label>
            <Switch
              id="success-stories"
              checked={preferences.success_stories_subscribed}
              onCheckedChange={(checked) =>
                updatePreference({ success_stories_subscribed: checked })
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="partner-offers" className="text-sm font-normal">
              Partner offers
            </Label>
            <Switch
              id="partner-offers"
              checked={preferences.partner_offers_subscribed}
              onCheckedChange={(checked) =>
                updatePreference({ partner_offers_subscribed: checked })
              }
              disabled={isSaving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

