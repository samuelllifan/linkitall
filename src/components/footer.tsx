import Link from "next/link";
import { WhatsNewLink } from "~/components/whats-new-link";

const LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/contact", label: "Contact Us" },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border bg-background">
      <div className="flex flex-col gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} stacked. All rights reserved.</span>
        <nav className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <WhatsNewLink />
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
