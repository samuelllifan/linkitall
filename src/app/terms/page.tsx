import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — stacked",
  description: "The terms that govern your use of stacked.",
};

// Last updated date for the terms. Update whenever the substance changes.
const LAST_UPDATED = "July 25, 2026";

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated: {LAST_UPDATED}
      </p>

      <div className="mt-10 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
        <section className="flex flex-col gap-3">
          <p>
            These Terms of Service ("Terms") govern your access to and use of
            stacked (the "Service"), operated by stacked ("stacked", "we", "us",
            or "our"). By creating an account or otherwise using the Service,
            you agree to be bound by these Terms. If you do not agree, do not
            use the Service.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            1. Who Can Use the Service
          </h2>
          <p>
            You must be at least 13 years old to use the Service. If you are
            under the age of majority where you live, you may use the Service
            only with the involvement of a parent or guardian. By using the
            Service, you represent that you meet these requirements and that the
            information you provide is accurate.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            2. Your Account
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activity that occurs under your
            account. You agree to notify us promptly of any unauthorized use.
            You may sign in using an email and password or a supported
            third-party provider such as Google.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            3. Your Content
          </h2>
          <p>
            The Service lets you create a public page with content such as a
            username, display name, bio, links, styling, and uploaded images
            ("Your Content"). You retain ownership of Your Content. You grant us
            a non-exclusive, worldwide, royalty-free license to host, store,
            display, and distribute Your Content solely as needed to operate and
            provide the Service — for example, to publish your page to visitors.
          </p>
          <p>
            You are solely responsible for Your Content and confirm that you
            have the rights necessary to post it and that it does not infringe
            the rights of others or violate any law.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            4. Acceptable Use
          </h2>
          <p>You agree not to use the Service to:</p>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            <li>
              Post content that is unlawful, infringing, fraudulent, harassing,
              hateful, or sexually exploitative;
            </li>
            <li>
              Impersonate any person or entity, or misrepresent your affiliation
              with anyone;
            </li>
            <li>
              Distribute malware, spam, or links intended to deceive or harm
              others;
            </li>
            <li>
              Attempt to gain unauthorized access to the Service, other
              accounts, or our systems, or interfere with the Service's normal
              operation;
            </li>
            <li>
              Use automated means to scrape, overload, or abuse the Service; or
            </li>
            <li>Violate any applicable law or the rights of others.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            5. Our Rights
          </h2>
          <p>
            We may modify, suspend, or discontinue any part of the Service at
            any time. We may also remove content or suspend or terminate
            accounts that we reasonably believe violate these Terms or harm the
            Service or other users. The Service and its underlying software,
            design, and branding are owned by us and protected by intellectual
            property laws; these Terms do not grant you any rights to them
            except as needed to use the Service.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            6. Termination
          </h2>
          <p>
            You may stop using the Service and delete your account at any time.
            We may suspend or terminate your access if you violate these Terms.
            Upon termination, your right to use the Service ends, and we may
            delete Your Content in accordance with our Privacy Policy.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            7. Disclaimers
          </h2>
          <p>
            The Service is provided "as is" and "as available," without
            warranties of any kind, whether express or implied, including
            warranties of merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the Service will be
            uninterrupted, secure, or error-free, or that any content will be
            accurate or reliable.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            8. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, stacked and its operators
            will not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or for any loss of data,
            profits, or goodwill, arising out of or related to your use of the
            Service. To the extent liability cannot be excluded, it is limited
            to the greater of the amount you paid us in the twelve months before
            the claim or USD $50.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            9. Indemnification
          </h2>
          <p>
            You agree to indemnify and hold harmless stacked and its operators
            from any claims, damages, liabilities, and expenses arising out of
            Your Content, your use of the Service, or your violation of these
            Terms or the rights of any third party.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            10. Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. When we do, we will
            revise the "Last updated" date above. If we make material changes,
            we will provide additional notice where appropriate. Your continued
            use of the Service after changes take effect constitutes acceptance
            of the updated Terms.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            11. Contact Us
          </h2>
          <p>
            If you have any questions about these Terms, contact us at{" "}
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
