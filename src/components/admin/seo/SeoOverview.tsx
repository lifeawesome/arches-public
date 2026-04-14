"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe,
  FileText,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Settings,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import type { SeoSettings } from "@/types/seo";

export default function SeoOverview() {
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/seo/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Error loading SEO settings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            SEO Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            SEO Settings Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Global SEO settings have not been configured yet.
          </p>
          <a href="/studio/structure/seoSettings" target="_blank" rel="noopener noreferrer">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Settings className="h-4 w-4 mr-2" />
              Configure in Sanity Studio
            </Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  const configuredItems = [
    { label: "Meta Title", value: settings.defaultMetaTitle },
    { label: "Meta Description", value: settings.defaultMetaDescription },
    { label: "Site URL", value: settings.siteUrl },
    { label: "Default OG Image", value: settings.defaultOgImage?.asset?.url },
    { label: "Google Analytics", value: settings.googleAnalyticsId },
    { label: "Google Tag Manager", value: settings.googleTagManagerId },
    { label: "Twitter Handle", value: settings.twitterHandle },
  ];

  const configuredCount = configuredItems.filter((item) => item.value).length;
  const configurationPercent = Math.round((configuredCount / configuredItems.length) * 100);

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global SEO Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Configuration Progress
                </span>
                <span className="text-sm font-bold text-orange-600">
                  {configurationPercent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${configurationPercent}%` }}
                />
              </div>
            </div>

            {/* Configured items */}
            <div className="grid grid-cols-2 gap-3">
              {configuredItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-sm"
                >
                  {item.value ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={item.value ? "text-gray-700" : "text-gray-400"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t flex items-center gap-3">
              <a href="/studio/structure/seoSettings" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit in Sanity Studio
                </Button>
              </a>
              <a href={settings.siteUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Site
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Redirects */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <Badge variant="secondary">
                {settings.redirects?.filter((r) => r.enabled !== false).length || 0}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">Active Redirects</p>
          </CardContent>
        </Card>

        {/* Sitemap */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-green-500" />
              <Badge variant={settings.sitemapEnabled !== false ? "default" : "secondary"}>
                {settings.sitemapEnabled !== false ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">XML Sitemap</p>
          </CardContent>
        </Card>
      </div>

      {/* Key Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Site Name</p>
              <p className="font-medium">{settings.siteName}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Site URL</p>
              <p className="font-medium truncate">{settings.siteUrl}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Meta Title</p>
              <p className="font-medium line-clamp-1">{settings.defaultMetaTitle}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Keywords</p>
              <p className="font-medium">
                {settings.defaultKeywords?.length || 0} keywords
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      {(settings.googleAnalyticsId || settings.googleTagManagerId) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5" />
              Analytics & Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {settings.googleAnalyticsId && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Google Analytics</span>
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {settings.googleAnalyticsId}
                </code>
              </div>
            )}
            {settings.googleTagManagerId && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Google Tag Manager</span>
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {settings.googleTagManagerId}
                </code>
              </div>
            )}
            {settings.facebookPixelId && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Facebook Pixel</span>
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {settings.facebookPixelId}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

