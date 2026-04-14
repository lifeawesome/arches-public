"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Search } from "lucide-react";

const PAGES = [
  { id: "homepage", label: "Homepage", path: "/" },
  { id: "pricing", label: "Pricing", path: "/pricing" },
  { id: "about", label: "About", path: "/about" },
  { id: "contact", label: "Contact", path: "/contact" },
  { id: "members", label: "Members", path: "/members" },
  { id: "experts", label: "Experts", path: "/experts" },
  { id: "blog", label: "Blog", path: "/blog" },
  { id: "events", label: "Events", path: "/events" },
  { id: "courses", label: "Courses", path: "/courses" },
];

export default function PageMetadataPreview() {
  const [selectedPage, setSelectedPage] = useState("homepage");
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/seo/preview/${selectedPage}`);
      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata);
      }
    } catch (error) {
      console.error("Error loading preview:", error);
    } finally {
      setLoading(false);
    }
  };

  const page = PAGES.find((p) => p.id === selectedPage);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Page Metadata Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Page Selector */}
        <div className="flex gap-3">
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a page" />
            </SelectTrigger>
            <SelectContent>
              {PAGES.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.label} ({page.path})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handlePreview} disabled={loading}>
            <Eye className="h-4 w-4 mr-2" />
            {loading ? "Loading..." : "Preview"}
          </Button>
        </div>

        {/* Metadata Preview */}
        {metadata && (
          <div className="space-y-6">
            {/* Basic Meta Tags */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Basic Meta Tags
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Title:</span>
                  <p className="font-medium mt-1">{metadata.title}</p>
                </div>
                <div>
                  <span className="text-gray-500">Description:</span>
                  <p className="font-medium mt-1">{metadata.description}</p>
                </div>
                {metadata.keywords && (
                  <div>
                    <span className="text-gray-500">Keywords:</span>
                    <p className="font-medium mt-1">{metadata.keywords}</p>
                  </div>
                )}
              </div>
            </div>

            {/* OpenGraph Preview */}
            {metadata.openGraph && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  OpenGraph (Social Media)
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">OG Title:</span>
                    <p className="font-medium mt-1">
                      {metadata.openGraph.title}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">OG Description:</span>
                    <p className="font-medium mt-1">
                      {metadata.openGraph.description}
                    </p>
                  </div>
                  {metadata.openGraph.images?.[0] && (
                    <div>
                      <span className="text-gray-500">OG Image:</span>
                      <p className="font-medium mt-1 text-xs break-all">
                        {metadata.openGraph.images[0].url}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Twitter Card */}
            {metadata.twitter && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Twitter Card
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Card Type:</span>
                    <p className="font-medium mt-1">{metadata.twitter.card}</p>
                  </div>
                  {metadata.twitter.site && (
                    <div>
                      <span className="text-gray-500">Site:</span>
                      <p className="font-medium mt-1">{metadata.twitter.site}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Robots */}
            {metadata.robots && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Robots Directives
                </h3>
                <div className="flex gap-2">
                  <Badge variant={metadata.robots.index ? "default" : "secondary"}>
                    {metadata.robots.index ? "Index" : "No Index"}
                  </Badge>
                  <Badge variant={metadata.robots.follow ? "default" : "secondary"}>
                    {metadata.robots.follow ? "Follow" : "No Follow"}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}

        {!metadata && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Select a page and click Preview to see metadata</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

