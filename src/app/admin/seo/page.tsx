"use client";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Settings, TrendingUp, Shield } from "lucide-react";
import Link from "next/link";
import SeoOverview from "@/components/admin/seo/SeoOverview";
import SeoHealthChecks from "@/components/admin/seo/SeoHealthChecks";
import RedirectsTable from "@/components/admin/seo/RedirectsTable";
import PageMetadataPreview from "@/components/admin/seo/PageMetadataPreview";

export default function SeoAdminPage() {
  return (
    <AdminLayout>
      <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Globe className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-montserratBold text-gray-900">
              SEO Management
            </h1>
            <p className="text-gray-600">
              Manage search engine optimization settings and monitor SEO health
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              View Sitemap
            </Button>
          </a>
          <a href="/robots.txt" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              View Robots.txt
            </Button>
          </a>
          <a href="/studio/structure/seoSettings" target="_blank" rel="noopener noreferrer">
            <Button className="bg-purple-500 hover:bg-purple-600">
              <Settings className="h-4 w-4 mr-2" />
              Open Sanity Studio
            </Button>
          </a>
        </div>
      </div>

      {/* Health Check */}
      <SeoHealthChecks />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* SEO Overview */}
        <SeoOverview />

        {/* Page Metadata Preview */}
        <PageMetadataPreview />
      </div>

      {/* Redirects Table */}
      <RedirectsTable />

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <a href="/studio/structure/seoSettings" target="_blank" rel="noopener noreferrer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-montserratBold text-gray-900 mb-1">
                    Global Settings
                  </h3>
                  <p className="text-sm text-gray-600">
                    Configure site-wide SEO defaults, analytics, and verification codes
                  </p>
                </div>
              </div>
            </CardContent>
          </a>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <a href="/studio/structure/page" target="_blank" rel="noopener noreferrer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Globe className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-montserratBold text-gray-900 mb-1">
                    Page-Level SEO
                  </h3>
                  <p className="text-sm text-gray-600">
                    Customize SEO settings for individual pages
                  </p>
                </div>
              </div>
            </CardContent>
          </a>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/admin/analytics">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-montserratBold text-gray-900 mb-1">
                    Analytics
                  </h3>
                  <p className="text-sm text-gray-600">
                    View platform analytics and insights
                  </p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* SEO Resources */}
      <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-montserratBold text-gray-900 mb-2">
                SEO Best Practices
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Keep meta titles under 60 characters</li>
                <li>• Keep meta descriptions under 160 characters</li>
                <li>• Use unique titles and descriptions for each page</li>
                <li>• Include relevant keywords naturally</li>
                <li>• Set up OpenGraph images (1200x630px recommended)</li>
                <li>• Verify your site with Google Search Console</li>
              </ul>
            </div>
            <Shield className="h-12 w-12 text-purple-300" />
          </div>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}

