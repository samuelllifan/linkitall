"use client";

import { type FormEvent, useEffect, useState } from "react";
import { AuroraGlow } from "~/components/aurora-glow";
import { Button } from "~/components/ui/button";
import { FormNote } from "~/components/ui/form-note";
import { GLYPH, Glyph } from "~/components/ui/glyph";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { createClient } from "~/lib/supabase/client";

// Fallback address surfaced if a submission fails to save.
const CONTACT_EMAIL = "support@stacked.page";

type Errors = Partial<Record<"name" | "email" | "subject" | "message", string>>;

// Basic email shape check — mirrors the check used on the login page.
const emailOk = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/**
 * The contact form.
 *
 * Built out of the app's own form parts rather than its own: the card is a
 * settings Panel's shell, the fields are Label + Input + FormNote exactly as
 * sign-in lays them out, and `.brand-accent` on the <main> is what makes them
 * focus in the brand purple. That last one was the visible tell that this page
 * was written separately — it used the very same `<Input>` component as the
 * login screen, and because nothing here set an accent scope the identical
 * control focused grey on this page and purple on that one.
 */
export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Signed in? Then we already know where to write back to, so don't make them
  // type it. Only ever fills a field the visitor hasn't touched (the state is
  // still empty), and it stays editable — someone may well want a reply
  // somewhere other than their account address.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled || !data.user?.email) return;
        setEmail((current) => current || data.user?.email || "");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    // `relative overflow-hidden` on the full-width main, with the column inside
    // it: the glow is 520px across with a 120px blur, so clipping it to the
    // `max-w-xl` column instead would cut it off at two hard vertical edges.
    <main className="brand-accent relative flex-1 overflow-hidden px-6 py-16">
      {/* Same drifting glow as the auth screens — this is the same kind of
          screen, one card on an otherwise empty page. Dimmer than theirs
          because this one sits between a navbar and a footer rather than
          filling the viewport on its own. */}
      <AuroraGlow className="opacity-[0.06]" />

      <div className="relative mx-auto w-full max-w-xl">
        <header className="animate-rise">
          <h1 className="font-semibold text-2xl tracking-tight">Contact us</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Have a question or some feedback? We'll get back to you.
          </p>
        </header>

        {submitted ? (
          <Card delay={60}>
            <div className="flex items-start gap-3.5">
              {/* The settings Panel's icon tile, at its exact geometry — this
                  is the same "a card is telling you something" moment. */}
              <span
                aria-hidden
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand-violet/25 bg-brand-violet/10 text-brand-violet"
              >
                <Glyph d={GLYPH.shieldCheck} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium text-foreground text-sm">
                  Message sent
                </h2>
                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                  Thanks for reaching out — we'll reply to{" "}
                  <span className="text-foreground">{email.trim()}</span> as
                  soon as we can.
                </p>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSubmitted(false);
                      setName("");
                      setSubject("");
                      setMessage("");
                      setErrors({});
                      setSubmitError(null);
                    }}
                  >
                    Send another
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card delay={60}>
            {/* `gap-4` between fields and `gap-2` within one, which is the
                spacing sign-in and sign-up use. */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-4"
            >
              {/* Name and email share a row from `sm` up: they are both one
                  short line, and stacking them pushed the message box — the
                  only field anybody actually thinks about — below the fold on a
                  laptop. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="name" label="Name" error={errors.name}>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={errors.name ? true : undefined}
                    autoComplete="name"
                  />
                </Field>

                <Field id="email" label="Email" error={errors.email}>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={errors.email ? true : undefined}
                    autoComplete="email"
                  />
                </Field>
              </div>

              <Field id="subject" label="Subject" error={errors.subject}>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  aria-invalid={errors.subject ? true : undefined}
                  placeholder="What's this about?"
                />
              </Field>

              <Field id="message" label="Message" error={errors.message}>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  aria-invalid={errors.message ? true : undefined}
                  placeholder="Tell us what's going on."
                />
              </Field>

              <FormNote tone="danger">{submitError}</FormNote>

              {/* Full width, like every other form's submit in the app. */}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send message"}
              </Button>
            </form>
          </Card>
        )}

        <p
          className="mt-4 animate-rise text-center text-muted-foreground text-xs"
          style={{ animationDelay: "120ms" }}
        >
          Prefer email? Write to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  );
}

/**
 * The card both states sit in — the settings Panel's shell (`elev-card` over
 * `bg-card`, staggered in on `.animate-rise`), so the form and a settings group
 * read as the same object.
 */
function Card({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mt-6 animate-rise elev-card rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand-violet/25"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * One labelled field plus its error line. The error is a {@link FormNote} — the
 * same dot, red and slide-in as the sign-in form's — rather than the bare red
 * sentence this page used to render, which sat a few pixels left of every other
 * status line in the app and appeared without any motion at all.
 */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FormNote tone="danger">{error}</FormNote>
    </div>
  );
}
