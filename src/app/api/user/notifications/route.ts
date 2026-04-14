import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  UpdateNotificationPreferencesRequest,
  NotificationPreferencesResponse,
} from "@/types/notifications";
import {
  unifyNotificationSettings,
  validateNotificationPreferences,
  getDefaultNotificationPreferences,
  getDefaultMarketingPreferences,
} from "@/lib/notifications/preferences";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch notification preferences
    const { data: notificationPrefs, error: notificationError } =
      await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

    // Fetch marketing preferences
    const { data: marketingPrefs, error: marketingError } = await supabase
      .from("marketing_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // If preferences don't exist, create defaults
    // PGRST116 is the error code for "no rows returned" from .single()
    if (notificationError && (notificationError.code === "PGRST116" || notificationError.message?.includes("No rows"))) {
      // Record doesn't exist, create it
      const defaults = getDefaultNotificationPreferences();
      // Remove in_app_notifications if column doesn't exist yet
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        email_direct_messages: defaults.email_direct_messages,
        email_project_requests: defaults.email_project_requests,
        email_system_notifications: defaults.email_system_notifications,
        email_frequency: defaults.email_frequency,
        push_notifications: defaults.push_notifications,
      };
      
      // Only include in_app_notifications if it exists (migration may not be run yet)
      if (defaults.in_app_notifications !== undefined) {
        insertData.in_app_notifications = defaults.in_app_notifications;
      }
      
      const { data: newPrefs, error: createError } = await supabase
        .from("user_notification_preferences")
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        console.error("Error creating notification preferences:", createError);
        return NextResponse.json(
          { 
            error: "Failed to create notification preferences",
            details: createError.message 
          },
          { status: 500 }
        );
      }

      // Use the newly created preferences
      const unified = unifyNotificationSettings(newPrefs, marketingPrefs);
      return NextResponse.json({ preferences: unified });
    }

    if (notificationError && notificationError.code !== "PGRST116" && !notificationError.message?.includes("No rows")) {
      console.error("Error fetching notification preferences:", notificationError);
      return NextResponse.json(
        { 
          error: "Failed to fetch notification preferences",
          details: notificationError.message,
          code: notificationError.code 
        },
        { status: 500 }
      );
    }

    // If marketing preferences don't exist, create defaults
    if (marketingError && (marketingError.code === "PGRST116" || marketingError.message?.includes("No rows"))) {
      // Record doesn't exist, create it
      const defaults = getDefaultMarketingPreferences();
      const { data: newPrefs, error: createError } = await supabase
        .from("marketing_preferences")
        .insert({
          user_id: user.id,
          ...defaults,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating marketing preferences:", createError);
        // Continue with null marketing prefs
      } else {
        // Use the newly created preferences
        const unified = unifyNotificationSettings(notificationPrefs, newPrefs);
        return NextResponse.json({ preferences: unified });
      }
    }

    if (marketingError) {
      console.error("Error fetching marketing preferences:", marketingError);
      // Continue with null marketing prefs
    }

    // Unify and return preferences
    const unified = unifyNotificationSettings(
      notificationPrefs,
      marketingPrefs
    );

    return NextResponse.json({ preferences: unified } as NotificationPreferencesResponse);
  } catch (error: unknown) {
    console.error("Error in GET /api/user/notifications:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateNotificationPreferencesRequest = await request.json();

    // Validate the request
    const validation = validateNotificationPreferences(body as Record<string, unknown>);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid preferences", details: validation.errors },
        { status: 400 }
      );
    }

    // Separate core and marketing preferences
    const coreFields = [
      "email_direct_messages",
      "email_project_requests",
      "email_system_notifications",
      "email_frequency",
      "push_notifications",
      "in_app_notifications",
    ] as const;

    const marketingFields = [
      "newsletter_subscribed",
      "product_updates_subscribed",
      "event_invitations_subscribed",
      "success_stories_subscribed",
      "partner_offers_subscribed",
    ] as const;

    const coreUpdate: Partial<Record<typeof coreFields[number], unknown>> = {};
    const marketingUpdate: Partial<
      Record<typeof marketingFields[number], unknown>
    > = {};

    // Extract core preferences
    for (const field of coreFields) {
      if (field in body) {
        coreUpdate[field] = body[field];
      }
    }

    // Extract marketing preferences
    for (const field of marketingFields) {
      if (field in body) {
        marketingUpdate[field] = body[field];
      }
    }

    // Update core notification preferences
    if (Object.keys(coreUpdate).length > 0) {
      const { data: existingCore, error: fetchError } = await supabase
        .from("user_notification_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

      if (fetchError && (fetchError.code === "PGRST116" || fetchError.message?.includes("No rows"))) {
        // Record doesn't exist, create it
        const defaults = getDefaultNotificationPreferences();
        const { error: createError } = await supabase
          .from("user_notification_preferences")
          .insert({
            user_id: user.id,
            ...defaults,
            ...coreUpdate,
          });

        if (createError) {
          console.error(
            "Error creating notification preferences:",
            createError
          );
          return NextResponse.json(
            { error: "Failed to update notification preferences" },
            { status: 500 }
          );
        }
      } else if (fetchError) {
        console.error("Error fetching notification preferences:", fetchError);
        return NextResponse.json(
          { error: "Failed to update notification preferences" },
          { status: 500 }
        );
      } else {
        // Update existing record
        const { error: updateError } = await supabase
          .from("user_notification_preferences")
          .update(coreUpdate)
          .eq("user_id", user.id);

        if (updateError) {
          console.error(
            "Error updating notification preferences:",
            updateError
          );
          return NextResponse.json(
            { error: "Failed to update notification preferences" },
            { status: 500 }
          );
        }
      }
    }

    // Update marketing preferences
    if (Object.keys(marketingUpdate).length > 0) {
      const { data: existingMarketing, error: fetchError } = await supabase
        .from("marketing_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

      if (fetchError && (fetchError.code === "PGRST116" || fetchError.message?.includes("No rows"))) {
        // Record doesn't exist, create it
        const defaults = getDefaultMarketingPreferences();
        const { error: createError } = await supabase
          .from("marketing_preferences")
          .insert({
            user_id: user.id,
            ...defaults,
            ...marketingUpdate,
          });

        if (createError) {
          console.error("Error creating marketing preferences:", createError);
          return NextResponse.json(
            { error: "Failed to update marketing preferences" },
            { status: 500 }
          );
        }
      } else if (fetchError) {
        console.error("Error fetching marketing preferences:", fetchError);
        return NextResponse.json(
          { error: "Failed to update marketing preferences" },
          { status: 500 }
        );
      } else {
        // Update existing record
        const { error: updateError } = await supabase
          .from("marketing_preferences")
          .update(marketingUpdate)
          .eq("user_id", user.id);

        if (updateError) {
          console.error("Error updating marketing preferences:", updateError);
          return NextResponse.json(
            { error: "Failed to update marketing preferences" },
            { status: 500 }
          );
        }
      }
    }

    // Fetch updated preferences
    const { data: updatedNotificationPrefs } = await supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { data: updatedMarketingPrefs } = await supabase
      .from("marketing_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Unify and return updated preferences
    const unified = unifyNotificationSettings(
      updatedNotificationPrefs,
      updatedMarketingPrefs
    );

    return NextResponse.json({
      preferences: unified,
    } as NotificationPreferencesResponse);
  } catch (error: unknown) {
    console.error("Error in PUT /api/user/notifications:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

