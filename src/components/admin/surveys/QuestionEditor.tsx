"use client";

import { useState } from "react";
import { QuestionFormData, QuestionType } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface QuestionEditorProps {
  questions: QuestionFormData[];
  onAdd: (question: QuestionFormData) => void;
  onUpdate: (index: number, question: QuestionFormData) => void;
  onDelete: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
}

export function QuestionEditor({
  questions,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: QuestionEditorProps) {
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState<QuestionFormData>({
    type: "multiple_choice",
    question_text: "",
    options: { choices: [""] },
    is_required: false,
    conditional_logic: null,
  });

  const handleAddQuestion = () => {
    if (!newQuestion.question_text.trim()) {
      alert("Please enter a question");
      return;
    }

    onAdd(newQuestion);
    setNewQuestion({
      type: "multiple_choice",
      question_text: "",
      options: { choices: [""] },
      is_required: false,
      conditional_logic: null,
    });
    setShowNewQuestion(false);
  };

  const handleTypeChange = (type: QuestionType) => {
    let options = {};
    if (type === "multiple_choice" || type === "checkboxes") {
      options = { choices: [""] };
    } else if (type === "rating") {
      options = { min_rating: 1, max_rating: 5 };
    } else if (type === "scale") {
      options = { scale_min: 1, scale_max: 10, scale_step: 1 };
    } else if (type === "matrix") {
      options = { rows: [""], columns: [""] };
    }

    setNewQuestion({ ...newQuestion, type, options });
  };

  const addChoice = () => {
    const choices = newQuestion.options.choices || [];
    setNewQuestion({
      ...newQuestion,
      options: { ...newQuestion.options, choices: [...choices, ""] },
    });
  };

  const updateChoice = (index: number, value: string) => {
    const choices = [...(newQuestion.options.choices || [])];
    choices[index] = value;
    setNewQuestion({
      ...newQuestion,
      options: { ...newQuestion.options, choices },
    });
  };

  const removeChoice = (index: number) => {
    const choices = (newQuestion.options.choices || []).filter(
      (_, i) => i !== index
    );
    setNewQuestion({
      ...newQuestion,
      options: { ...newQuestion.options, choices },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questions</CardTitle>
        <CardDescription>Add questions to your survey</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Questions */}
        {questions.map((question, index) => (
          <Card key={index} className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onMove(index, "up")}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onMove(index, "down")}
                    disabled={index === questions.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium">
                        Q{index + 1}: {question.question_text}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {question.type.replace(/_/g, " ")}
                        {question.is_required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {(question.type === "multiple_choice" ||
                    question.type === "checkboxes") && (
                    <ul className="list-disc list-inside text-sm text-muted-foreground ml-4">
                      {question.options.choices?.map((choice, i) => (
                        <li key={i}>{choice}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add New Question */}
        {!showNewQuestion ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowNewQuestion(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={newQuestion.type}
                  onValueChange={(value) => handleTypeChange(value as QuestionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="checkboxes">Checkboxes</SelectItem>
                    <SelectItem value="text">Short Text</SelectItem>
                    <SelectItem value="long_text">Long Text</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="scale">Scale</SelectItem>
                    <SelectItem value="matrix">Matrix</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Question *</Label>
                <Textarea
                  placeholder="Enter your question..."
                  value={newQuestion.question_text}
                  onChange={(e) =>
                    setNewQuestion({
                      ...newQuestion,
                      question_text: e.target.value,
                    })
                  }
                  rows={2}
                />
              </div>

              {/* Question-specific options */}
              {(newQuestion.type === "multiple_choice" ||
                newQuestion.type === "checkboxes") && (
                <div className="space-y-2">
                  <Label>Choices</Label>
                  {(newQuestion.options.choices || []).map((choice, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Choice ${index + 1}`}
                        value={choice}
                        onChange={(e) => updateChoice(index, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeChoice(index)}
                        disabled={
                          (newQuestion.options.choices?.length || 0) <= 1
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addChoice}>
                    <Plus className="mr-2 h-3 w-3" />
                    Add Choice
                  </Button>
                </div>
              )}

              {newQuestion.type === "rating" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Rating</Label>
                    <Input
                      type="number"
                      value={newQuestion.options.min_rating || 1}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          options: {
                            ...newQuestion.options,
                            min_rating: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Rating</Label>
                    <Input
                      type="number"
                      value={newQuestion.options.max_rating || 5}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          options: {
                            ...newQuestion.options,
                            max_rating: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {newQuestion.type === "scale" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Min</Label>
                    <Input
                      type="number"
                      value={newQuestion.options.scale_min || 1}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          options: {
                            ...newQuestion.options,
                            scale_min: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max</Label>
                    <Input
                      type="number"
                      value={newQuestion.options.scale_max || 10}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          options: {
                            ...newQuestion.options,
                            scale_max: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Step</Label>
                    <Input
                      type="number"
                      value={newQuestion.options.scale_step || 1}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          options: {
                            ...newQuestion.options,
                            scale_step: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="required"
                  checked={newQuestion.is_required}
                  onCheckedChange={(checked) =>
                    setNewQuestion({ ...newQuestion, is_required: !!checked })
                  }
                />
                <label htmlFor="required" className="text-sm cursor-pointer">
                  Required question
                </label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddQuestion}>Add Question</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNewQuestion(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

