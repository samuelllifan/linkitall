import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — stacked",
  description: "How stacked collects, uses, and protects your information.",
};

// Last updated date for the policy. Update whenever the substance changes.
const LAST_UPDATED = "July 25, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated: {LAST_UPDATED}
      </p>

      <div className="mt-10 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
        <section className="flex flex-col gap-3">
          <p>
            This Privacy Policy explains how stacked ("stacked", "we", "us", or
            "our") collects, uses, and shares information when you use our
            website and services (the "Service"). By using the Service, you
            agree to the practices described here.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            1. Information We Collect
          </h2>
          <p>We collect the following categories of information:</p>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            <li>
              <span className="font-medium text-foreground">
                Account information.
              </span>{" "}
              When you create an account, we collect your email address and a
              password. Passwords are stored in a securely hashed form and are
              never visible to us. If you sign in with Google, we receive basic
              account details from Google (such as your email address) to
              authenticate you.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Profile and page content.
              </span>{" "}
              We store the content you choose to create, including your
              username, display name, bio, links, page styling, and any images
              or media you upload (such as an avatar or background). This
              content is published on your public page and is visible to anyone
              who visits it.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Analytics about page visits.
              </span>{" "}
              When someone visits a public page, we record limited, anonymous
              analytics so the page owner can see how their page is performing.
              This includes a randomly generated visitor identifier stored in
              the visitor's browser (used only to count unique views), the type
              of device used (mobile, tablet, or desktop), and which page views
              and link clicks occur. This data is not linked to a visitor's name
              or identity.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Cookies and similar technologies.
              </span>{" "}
              We use cookies and similar browser storage that are necessary to
              operate the Service, primarily to keep you signed in. We do not
              use third-party advertising or cross-site tracking cookies.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            2. How We Use Information
          </h2>
          <p>We use the information we collect to:</p>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            <li>Provide, maintain, and improve the Service;</li>
            <li>
              Create and authenticate your account and keep you signed in;
            </li>
            <li>Publish and display the public page you create;</li>
            <li>
              Show page owners aggregate analytics about visits and clicks to
              their own pages;
            </li>
            <li>
              Protect the security and integrity of the Service and prevent
              abuse;
            </li>
            <li>Respond to your requests and communicate with you.</li>
          </ul>
          <p>
            We do not sell your personal information, and we do not use your
            content to serve third-party advertising.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            3. How We Share Information
          </h2>
          <p>
            We share information only in the limited circumstances described
            below:
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            <li>
              <span className="font-medium text-foreground">
                Service providers.
              </span>{" "}
              We use trusted third parties to run the Service, including
              Supabase (for database hosting, authentication, and file storage)
              and Google (only if you choose to sign in with Google). These
              providers process data on our behalf and are bound by their own
              privacy and security obligations.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Public content.
              </span>{" "}
              Anything you add to your public page is, by design, visible to
              anyone who visits that page.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Legal reasons.
              </span>{" "}
              We may disclose information if required by law, or to protect the
              rights, safety, and security of our users or the Service.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            4. Data Retention
          </h2>
          <p>
            We keep your account and page content for as long as your account is
            active. If you delete your account, we delete the personal
            information associated with it, except where we are required to
            retain it for legal or security purposes. Anonymous analytics may be
            retained in aggregate form.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            5. Your Rights and Choices
          </h2>
          <p>
            You can access and update most of your information directly in your
            account settings. Depending on where you live, you may have the
            right to access, correct, export, or delete your personal
            information, or to object to certain processing. To make a request,
            contact us using the details below. You may also delete your account
            at any time, which removes your associated personal data.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">6. Security</h2>
          <p>
            We take reasonable technical and organizational measures to protect
            your information, including encryption in transit and hashed
            password storage. However, no method of transmission or storage is
            completely secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            7. Children's Privacy
          </h2>
          <p>
            The Service is not directed to children under 13, and we do not
            knowingly collect personal information from children under 13. If
            you believe a child has provided us with personal information,
            please contact us and we will take steps to delete it.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            8. International Users
          </h2>
          <p>
            We may process and store information in countries other than the one
            in which you live. Where we transfer information, we take steps to
            ensure it remains protected in accordance with this Policy.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            9. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we
            will revise the "Last updated" date above. If we make material
            changes, we will provide additional notice where appropriate.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            10. Contact Us
          </h2>
          <p>
            If you have any questions about this Privacy Policy or how we handle
            your information, contact us at{" "}
            <a
              href="mailto:support@stacked.page"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              support@stacked.page
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
