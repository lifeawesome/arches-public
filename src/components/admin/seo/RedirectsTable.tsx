"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Edit } from "lucide-react";
import type { RedirectConfig } from "@/types/seo";

export default function RedirectsTable() {
  const [redirects, setRedirects] = useState<RedirectConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRedirects();
  }, []);

  const loadRedirects = async () => {
    try {
      const response = await fetch("/api/admin/seo/settings");
      if (response.ok) {
        const data = await response.json();
        setRedirects(data.redirects || []);
      }
    } catch (error) {
      console.error("Error loading redirects:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>URL Redirects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (redirects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>URL Redirects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No redirects configured yet.</p>
            <a href="/studio/structure/seoSettings" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Add Redirects in Sanity
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (statusCode: number) => {
    const config = {
      301: { label: "301 Permanent", className: "bg-blue-500" },
      302: { label: "302 Temporary", className: "bg-yellow-500" },
      307: { label: "307 Temporary", className: "bg-yellow-500" },
      308: { label: "308 Permanent", className: "bg-blue-500" },
    };

    const status = config[statusCode as keyof typeof config] || {
      label: String(statusCode),
      className: "bg-gray-500",
    };

    return (
      <Badge className={`${status.className} text-white`}>{status.label}</Badge>
    );
  };

  const activeRedirects = redirects.filter((r) => r.enabled !== false);
  const disabledRedirects = redirects.filter((r) => r.enabled === false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>URL Redirects</CardTitle>
        <a href="/studio/structure/seoSettings" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Manage in Sanity
          </Button>
        </a>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Active Redirects */}
          {activeRedirects.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Active ({activeRedirects.length})
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">From</TableHead>
                      <TableHead className="w-[35%]">To</TableHead>
                      <TableHead className="w-[20%]">Type</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRedirects.map((redirect) => (
                      <TableRow key={redirect._key}>
                        <TableCell className="font-mono text-sm">
                          {redirect.from}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {redirect.to}
                        </TableCell>
                        <TableCell>{getStatusBadge(redirect.statusCode)}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-500">
                            Active
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Disabled Redirects */}
          {disabledRedirects.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Disabled ({disabledRedirects.length})
              </h3>
              <div className="border rounded-lg overflow-hidden opacity-60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">From</TableHead>
                      <TableHead className="w-[35%]">To</TableHead>
                      <TableHead className="w-[20%]">Type</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disabledRedirects.map((redirect) => (
                      <TableRow key={redirect._key}>
                        <TableCell className="font-mono text-sm">
                          {redirect.from}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {redirect.to}
                        </TableCell>
                        <TableCell>{getStatusBadge(redirect.statusCode)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Disabled</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

