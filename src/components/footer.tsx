export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border bg-white dark:bg-black">
      <div className="flex flex-col gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} stacked. All rights reserved.</span>
        <nav className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <a
            href="/privacy"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Terms of Service
          </a>
          <a
            href="/contact"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Contact Us
          </a>
        </nav>
      </div>
    </footer>
  );
}
