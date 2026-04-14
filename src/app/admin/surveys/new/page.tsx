"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { QuestionEditor } from "@/components/admin/surveys/QuestionEditor";
import { AudienceSelector } from "@/components/admin/surveys/AudienceSelector";
import { SurveyPreview } from "@/components/admin/surveys/SurveyPreview";
import { QuestionFormData, SurveyFormData } from "@/types/survey";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function NewSurveyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SurveyFormData>({
    title: "",
    description: "",
    status: "draft",
    target_audience: { type: "all" },
    delivery_method: ["in_app"],
    closes_at: null,
    questions: [],
  });

  const handleAddQuestion = (question: QuestionFormData) => {
    setFormData({
      ...formData,
      questions: [...formData.questions, question],
    });
  };

  const handleUpdateQuestion = (index: number, question: QuestionFormData) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = question;
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleDeleteQuestion = (index: number) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index),
    });
  };

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.questions.length) return;

    const newQuestions = [...formData.questions];
    [newQuestions[index], newQuestions[newIndex]] = [
      newQuestions[newIndex],
      newQuestions[index],
    ];
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleSave = async (publish: boolean = false) => {
    if (!formData.title.trim()) {
      alert("Please enter a survey title");
      return;
    }

    if (formData.questions.length === 0) {
      alert("Please add at least one question");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          status: publish ? "active" : "draft",
        }),
      });

      if (!response.ok) throw new Error("Failed to create survey");

      const survey = await response.json();

      if (publish) {
        // Publish the survey
        await fetch(`/api/admin/surveys/${survey.id}/publish`, {
          method: "POST",
        });
        alert("Survey published and notifications sent!");
      }

      router.push("/admin/surveys");
    } catch (error) {
      console.error("Error saving survey:", error);
      alert("Failed to save survey");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Create New Survey</h1>
          <p className="text-muted-foreground mt-1">
            Build your survey and send it to your target audience
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            Publish & Send
          </Button>
        </div>
      </div>

      <Tabs defaultValue="build" className="w-full">
        <TabsList>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Survey Details</CardTitle>
              <CardDescription>Basic information about your survey</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Q1 2026 Product Feedback"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell users what this survey is about..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Method</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="in_app"
                      checked={formData.delivery_method.includes("in_app")}
                      onCheckedChange={(checked: boolean) => {
                        const methods = checked
                          ? [...formData.delivery_method, "in_app"]
                          : formData.delivery_method.filter((m) => m !== "in_app");
                        setFormData({ ...formData, delivery_method: methods });
                      }}
                    />
                    <label htmlFor="in_app" className="text-sm cursor-pointer">
                      In-App Notification
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email"
                      checked={formData.delivery_method.includes("email")}
                      onCheckedChange={(checked: boolean) => {
                        const methods = checked
                          ? [...formData.delivery_method, "email"]
                          : formData.delivery_method.filter((m) => m !== "email");
                        setFormData({ ...formData, delivery_method: methods });
                      }}
                    />
                    <label htmlFor="email" className="text-sm cursor-pointer">
                      Email
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audience */}
          <AudienceSelector
            value={formData.target_audience}
            onChange={(audience) =>
              setFormData({ ...formData, target_audience: audience })
            }
          />

          {/* Questions */}
          <QuestionEditor
            questions={formData.questions}
            onAdd={handleAddQuestion}
            onUpdate={handleUpdateQuestion}
            onDelete={handleDeleteQuestion}
            onMove={handleMoveQuestion}
          />
        </TabsContent>

        <TabsContent value="preview">
          <SurveyPreview survey={formData} />
        </TabsContent>
      </Tabs>
      </div>
    </AdminLayout>
  );
}

