"use client";

import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  moveArrayItem,
  updateContentField,
  type TaskTypeContentEditorProps,
} from "./utils";

interface Question {
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

export function TakeQuizEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const questions = (content.questions as Question[]) || [];
  const passing_score = (content.passing_score as number) || 0;

  const addQuestion = () => {
    addArrayItem(
      content,
      "questions",
      {
        question_text: "",
        options: [""],
        correct_answer: 0,
        explanation: "",
      },
      onChange
    );
  };

  const removeQuestion = (index: number) => {
    removeArrayItem(content, "questions", index, onChange);
  };

  const updateQuestion = (index: number, field: keyof Question, value: unknown) => {
    const question = questions[index] || {};
    updateArrayItem(
      content,
      "questions",
      index,
      { ...question, [field]: value },
      onChange
    );
  };

  const addOption = (questionIndex: number) => {
    const question = questions[questionIndex] || { options: [] };
    const options = question.options || [];
    updateQuestion(questionIndex, "options", [...options, ""]);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex] || { options: [] };
    const options = question.options || [];
    updateQuestion(
      questionIndex,
      "options",
      options.filter((_, i) => i !== optionIndex)
    );
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const question = questions[questionIndex] || { options: [] };
    const options = question.options || [];
    const updatedOptions = [...options];
    updatedOptions[optionIndex] = value;
    updateQuestion(questionIndex, "options", updatedOptions);
  };

  const moveQuestion = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex >= 0 && toIndex < questions.length) {
      moveArrayItem(content, "questions", fromIndex, toIndex, onChange);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">Questions</label>
        <div className="space-y-4">
          {questions.map((question, qIndex) => (
            <div
              key={qIndex}
              className="rounded-lg border-2 border-border bg-muted/30 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Question {qIndex + 1}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(qIndex, "up")}
                        disabled={qIndex === 0}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-background disabled:opacity-50"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(qIndex, "down")}
                        disabled={qIndex === questions.length - 1}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-background disabled:opacity-50"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={question.question_text || ""}
                    onChange={(e) =>
                      updateQuestion(qIndex, "question_text", e.target.value)
                    }
                    placeholder="Enter question text..."
                    rows={2}
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4 space-y-2">
                <label className="block text-sm font-medium">Options</label>
                {(question.options || []).map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={question.correct_answer === oIndex}
                      onChange={() => updateQuestion(qIndex, "correct_answer", oIndex)}
                      className="h-4 w-4 text-primary"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                      placeholder={`Option ${oIndex + 1}`}
                      className="flex-1 rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(qIndex, oIndex)}
                      className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
                      disabled={(question.options || []).length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(qIndex)}
                  className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  Add Option
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Explanation (optional)
                </label>
                <textarea
                  value={question.explanation || ""}
                  onChange={(e) =>
                    updateQuestion(qIndex, "explanation", e.target.value)
                  }
                  placeholder="Explanation for the correct answer..."
                  rows={2}
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Passing Score (%)</label>
        <input
          type="number"
          value={passing_score}
          onChange={(e) =>
            updateContentField(
              content,
              "passing_score",
              parseInt(e.target.value, 10) || 0,
              onChange
            )
          }
          min="0"
          max="100"
          placeholder="70"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



