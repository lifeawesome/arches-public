"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserWithRoleClient } from "@/utils/auth/roles.client";
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
import { QuestionFormData, SurveyFormData, SurveyWithQuestions } from "@/types/survey";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function EditSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [formData, setFormData] = useState<SurveyFormData>({
    title: "",
    description: "",
    status: "draft",
    target_audience: { type: "all" },
    delivery_method: ["in_app"],
    closes_at: null,
    questions: [],
  });

  useEffect(() => {
    params.then((p) => {
      setSurveyId(p.id);
      checkAuthAndLoad(p.id);
    });
  }, []);

  const checkAuthAndLoad = async (id: string) => {
    const userWithRole = await getCurrentUserWithRoleClient();

    if (!userWithRole || userWithRole.role !== "admin") {
      router.push("/account?message=Admin access required");
      return;
    }

    setAuthorized(true);
    loadSurvey(id);
  };

  const loadSurvey = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/surveys/${id}`);
      if (!response.ok) throw new Error("Failed to fetch survey");

      const data: SurveyWithQuestions = await response.json();
      setFormData({
        title: data.title,
        description: data.description || "",
        status: data.status,
        target_audience: data.target_audience,
        delivery_method: data.delivery_method,
        closes_at: data.closes_at,
        questions: data.questions.map((q) => ({
          id: q.id,
          type: q.type,
          question_text: q.question_text,
          options: q.options,
          is_required: q.is_required,
          conditional_logic: q.conditional_logic,
        })),
      });
    } catch (error) {
      console.error("Error loading survey:", error);
      alert("Failed to load survey");
      router.push("/account/admin/surveys");
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!surveyId || !formData.title.trim()) {
      alert("Please enter a survey title");
      return;
    }

    if (formData.questions.length === 0) {
      alert("Please add at least one question");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/surveys/${surveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to update survey");

      alert("Survey updated successfully!");
      router.push("/account/admin/surveys");
    } catch (error) {
      console.error("Error saving survey:", error);
      alert("Failed to save survey");
    } finally {
      setSaving(false);
    }
  };

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/account/admin/surveys")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Edit Survey</h1>
          <p className="text-muted-foreground mt-1">
            Update your survey details and questions
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
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
                      onCheckedChange={(checked) => {
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
                      onCheckedChange={(checked) => {
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
  );
}

