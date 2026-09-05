import Link from "next/link";
import { FOOTER_LINK_CLASS } from "~/components/footer-link-class";
import { WhatsNewLink } from "~/components/whats-new-link";

const LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  // Sentence case, unlike the two above it: those are the NAMES of
  // documents, this is an instruction. It also has to match the heading on
  // the page it opens, which is the app's house style everywhere else
  // ("Sign in", "Back home", "Delete account").
  { href: "/contact", label: "Contact us" },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border bg-background">
      <div className="flex flex-col gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} stacked. All rights reserved.</span>
        {/* Named, because the site header is also a <nav>: without labels a
            screen-reader user listing landmarks gets two identical
            "navigation" entries. Bare nouns — assistive tech already appends
            the word "navigation". */}
        <nav
          aria-label="Footer"
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          <WhatsNewLink />
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={FOOTER_LINK_CLASS}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
