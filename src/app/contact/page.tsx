"use client";

import { type FormEvent, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

// Fallback address surfaced if a submission fails to save.
const CONTACT_EMAIL = "support@stacked.page";

type Errors = Partial<Record<"name" | "email" | "subject" | "message", string>>;

// Basic email shape check — mirrors the check used on the login page.
const emailOk = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = "Please enter your name.";
    if (!email.trim()) next.email = "Please enter your email.";
    else if (!emailOk(email))
      next.email = "Please enter a valid email address.";
    if (!subject.trim()) next.subject = "Please enter a subject.";
    if (!message.trim()) next.message = "Please enter a message.";
    else if (message.trim().length < 10)
      next.message =
        "Please add a little more detail (at least 10 characters).";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    // Attribute the message to the signed-in user when there is one; anonymous
    // visitors submit with submitted_by null (allowed by the RLS insert policy).
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("contact_messages").insert({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      submitted_by: user?.id ?? null,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(
        "Something went wrong sending your message. Please try again.",
      );
      return;
    }

    setSubmitted(true);
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Contact Us
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Have a question or feedback? Fill out the form below and we'll get back
        to you.
      </p>

      {submitted ? (
        <div className="mt-10 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Thanks for reaching out!
          </p>
          <p className="mt-2">
            We've received your message and will get back to you soon. You can
            also reach us anytime at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-10 flex flex-col gap-6"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-invalid={Boolean(errors.name)}
              autoComplete="name"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
              aria-invalid={Boolean(errors.subject)}
            />
            {errors.subject && (
              <p className="text-sm text-destructive">{errors.subject}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              rows={6}
              aria-invalid={Boolean(errors.message)}
              className={cn(
                "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground md:text-sm dark:bg-input/30",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
              )}
            />
            {errors.message && (
              <p className="text-sm text-destructive">{errors.message}</p>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send Message"}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
