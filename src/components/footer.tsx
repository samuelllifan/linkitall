export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="flex w-full flex-col gap-8 px-6 py-12 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-foreground">linkitall</span>
          <p className="max-w-xs text-sm text-muted-foreground">
            One link for everything you make, all in one place.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Customer service</span>
          <a
            href="mailto:support@linkitall.com"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            support@linkitall.com
          </a>
        </div>
      </div>
      <div className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} linkitall. All rights reserved.
      </div>
    </footer>
  );
}
