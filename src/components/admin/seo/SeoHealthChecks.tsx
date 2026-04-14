"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Globe,
  TrendingUp,
  BarChart3,
  Shield,
} from "lucide-react";
import type { SeoHealthCheck } from "@/types/seo";

export default function SeoHealthChecks() {
  const [health, setHealth] = useState<SeoHealthCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealthCheck();
  }, []);

  const loadHealthCheck = async () => {
    try {
      const response = await fetch("/api/admin/seo/health");
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (error) {
      console.error("Error loading SEO health check:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SEO Health Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Health Check</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Unable to load health check data.</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    healthy: {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-50",
      border: "border-green-200",
      badge: "bg-green-500",
      label: "Healthy",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-yellow-500",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      badge: "bg-yellow-500",
      label: "Warning",
    },
    error: {
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-200",
      badge: "bg-red-500",
      label: "Error",
    },
  };

  const config = statusConfig[health.status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card className={`border-2 ${config.border}`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${config.bg}`}>
              <StatusIcon className={`h-8 w-8 ${config.color}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-montserratBold text-gray-900 mb-1">
                Overall SEO Health
              </h3>
              <Badge className={`${config.badge} text-white`}>
                {config.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Sitemap */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-gray-400" />
              {health.checks.sitemapAccessible ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">Sitemap</p>
            <p className="text-xs text-gray-500">
              {health.checks.sitemapAccessible ? "Enabled" : "Disabled"}
            </p>
          </CardContent>
        </Card>

        {/* Robots.txt */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Globe className="h-5 w-5 text-gray-400" />
              {health.checks.robotsTxtAccessible ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">Robots.txt</p>
            <p className="text-xs text-gray-500">
              {health.checks.robotsTxtAccessible ? "Active" : "Inactive"}
            </p>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="h-5 w-5 text-gray-400" />
              {health.checks.analyticsConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">Analytics</p>
            <p className="text-xs text-gray-500">
              {health.checks.analyticsConfigured ? "Configured" : "Not Set"}
            </p>
          </CardContent>
        </Card>

        {/* Global Settings */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Shield className="h-5 w-5 text-gray-400" />
              {health.checks.globalSettingsComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">Settings</p>
            <p className="text-xs text-gray-500">
              {health.checks.globalSettingsComplete ? "Complete" : "Incomplete"}
            </p>
          </CardContent>
        </Card>

        {/* Page Coverage */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-gray-400" />
              <span className="text-lg font-bold text-orange-600">
                {health.checks.pagesWithCustomSeo}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900">Custom SEO Pages</p>
            <p className="text-xs text-gray-500">
              of {health.checks.totalPages} total
            </p>
          </CardContent>
        </Card>

        {/* Redirects */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-gray-400" />
              <span className="text-lg font-bold text-blue-600">
                {health.checks.activeRedirects}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900">Redirects</p>
            <p className="text-xs text-gray-500">Active rules</p>
          </CardContent>
        </Card>
      </div>

      {/* Issues */}
      {health.issues.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Issues Found:</p>
            <ul className="list-disc list-inside space-y-1">
              {health.issues.map((issue, idx) => (
                <li key={idx} className="text-sm">
                  {issue}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {health.warnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <p className="font-medium mb-2">Warnings:</p>
            <ul className="list-disc list-inside space-y-1">
              {health.warnings.map((warning, idx) => (
                <li key={idx} className="text-sm">
                  {warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

