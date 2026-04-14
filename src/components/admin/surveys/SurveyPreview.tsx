"use client";

import { SurveyFormData } from "@/types/survey";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

interface SurveyPreviewProps {
  survey: SurveyFormData;
}

export function SurveyPreview({ survey }: SurveyPreviewProps) {
  const renderQuestion = (question: any, index: number) => {
    const { type, question_text, options, is_required } = question;

    return (
      <Card key={index} className="mb-4">
        <CardContent className="pt-6">
          <Label className="text-base">
            {index + 1}. {question_text}
            {is_required && <span className="text-red-500 ml-1">*</span>}
          </Label>

          <div className="mt-4">
            {type === "multiple_choice" && (
              <RadioGroup>
                {options.choices?.map((choice: string, i: number) => (
                  <div key={i} className="flex items-center space-x-2">
                    <RadioGroupItem value={`choice-${i}`} id={`q${index}-${i}`} />
                    <label htmlFor={`q${index}-${i}`}>{choice}</label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {type === "checkboxes" && (
              <div className="space-y-2">
                {options.choices?.map((choice: string, i: number) => (
                  <div key={i} className="flex items-center space-x-2">
                    <Checkbox id={`q${index}-${i}`} />
                    <label htmlFor={`q${index}-${i}`}>{choice}</label>
                  </div>
                ))}
              </div>
            )}

            {type === "text" && (
              <Input placeholder="Your answer..." className="max-w-md" />
            )}

            {type === "long_text" && (
              <Textarea placeholder="Your answer..." rows={4} />
            )}

            {type === "rating" && (
              <div className="flex gap-2">
                {Array.from(
                  { length: (options.max_rating || 5) - (options.min_rating || 1) + 1 },
                  (_, i) => i + (options.min_rating || 1)
                ).map((rating) => (
                  <Button
                    key={rating}
                    variant="outline"
                    className="w-12 h-12"
                  >
                    {rating}
                  </Button>
                ))}
              </div>
            )}

            {type === "scale" && (
              <div className="space-y-4">
                <Slider
                  min={options.scale_min || 1}
                  max={options.scale_max || 10}
                  step={options.scale_step || 1}
                  defaultValue={[options.scale_min || 1]}
                  className="w-full max-w-md"
                />
                <div className="flex justify-between text-sm text-muted-foreground max-w-md">
                  <span>{options.min_label || options.scale_min}</span>
                  <span>{options.max_label || options.scale_max}</span>
                </div>
              </div>
            )}

            {type === "matrix" && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2"></th>
                      {options.columns?.map((col: string, i: number) => (
                        <th key={i} className="border p-2 text-sm">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {options.rows?.map((row: string, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 text-sm font-medium">{row}</td>
                        {options.columns?.map((_: string, j: number) => (
                          <td key={j} className="border p-2 text-center">
                            <RadioGroup>
                              <RadioGroupItem value={`${i}-${j}`} />
                            </RadioGroup>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="border-t-4 border-t-orange-500">
        <CardHeader>
          <CardTitle className="text-2xl">{survey.title || "Untitled Survey"}</CardTitle>
          {survey.description && (
            <CardDescription className="text-base mt-2">
              {survey.description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {survey.questions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No questions added yet. Switch to the Build tab to add questions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {survey.questions.map((question, index) =>
            renderQuestion(question, index)
          )}

          <Card>
            <CardContent className="pt-6">
              <Button className="w-full">Submit Survey</Button>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Preview Mode</span>
        <span>{survey.questions.length} question(s)</span>
      </div>
    </div>
  );
}

// Import Button for the preview
import { Button } from "@/components/ui/button";

