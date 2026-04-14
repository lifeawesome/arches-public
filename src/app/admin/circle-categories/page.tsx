"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CircleCategory } from "@/types/circles";
import { Plus, Pencil, Power, PowerOff } from "lucide-react";

export default function CircleCategoriesPage() {
  const [categories, setCategories] = useState<CircleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/admin/circle-categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/circle-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim() || undefined,
          sort_order: newSortOrder,
          is_active: true,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewSlug("");
        setNewSortOrder(categories.length);
        loadCategories();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create category");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (cat: CircleCategory) => {
    try {
      const res = await fetch(`/api/admin/circle-categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      if (res.ok) loadCategories();
      else alert("Failed to update");
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (cat: CircleCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditSortOrder(cat.sort_order);
    setEditActive(cat.is_active);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/circle-categories/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug.trim(),
          sort_order: editSortOrder,
          is_active: editActive,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        loadCategories();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Circle categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage categories for the Circle Directory. Default categories are seeded; you can add, edit, or deactivate.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add category</CardTitle>
            <CardDescription>New categories appear in the directory filter and circle forms.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Security"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-slug">Slug (optional)</Label>
                <Input
                  id="new-slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g. security"
                />
              </div>
              <div className="space-y-2 w-24">
                <Label htmlFor="new-order">Order</Label>
                <Input
                  id="new-order"
                  type="number"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <Button type="submit" disabled={adding || !newName.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All categories</CardTitle>
            <CardDescription>Edit or deactivate to hide from directory and forms.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cat.slug}</TableCell>
                      <TableCell>{cat.sort_order}</TableCell>
                      <TableCell>
                        {cat.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(cat)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit category</DialogTitle>
                                <DialogDescription>
                                  Change name, slug, order, or active status.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label>Name</Label>
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Slug</Label>
                                  <Input
                                    value={editSlug}
                                    onChange={(e) => setEditSlug(e.target.value)}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Sort order</Label>
                                  <Input
                                    type="number"
                                    value={editSortOrder}
                                    onChange={(e) =>
                                      setEditSortOrder(parseInt(e.target.value, 10) || 0)
                                    }
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="edit-active"
                                    checked={editActive}
                                    onChange={(e) => setEditActive(e.target.checked)}
                                  />
                                  <Label htmlFor="edit-active">Active (visible in directory)</Label>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveEdit} disabled={saving}>
                                  Save
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(cat)}
                            title={cat.is_active ? "Deactivate" : "Activate"}
                          >
                            {cat.is_active ? (
                              <PowerOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Power className="h-4 w-4 text-primary" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
