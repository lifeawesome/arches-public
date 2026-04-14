"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { updateEmail } from "@/lib/utils/auth-helpers/server";
import { handleRequest } from "@/lib/utils/auth-helpers/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EmailForm({
  userEmail,
}: {
  userEmail: string | undefined;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true);
    // Check if the new email is the same as the old email
    if (e.currentTarget.newEmail.value === userEmail) {
      e.preventDefault();
      setIsSubmitting(false);
      return;
    }
    handleRequest(e, updateEmail, router);
    setIsSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Email</CardTitle>
        <CardDescription>
          Please enter the email address you want to use to login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mt-8 mb-4 text-xl font-semibold">
          <form id="emailForm" onSubmit={(e) => handleSubmit(e)}>
            <input
              type="text"
              name="newEmail"
              className="w-1/2 p-3 rounded-md bg-zinc-800"
              defaultValue={userEmail ?? ""}
              placeholder="Your email"
              maxLength={64}
            />
          </form>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center w-full">
          <p className="pb-4 sm:pb-0">
            We will email you to verify the change.
          </p>
          <Button
            variant="outline"
            type="submit"
            form="emailForm"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update Email"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
