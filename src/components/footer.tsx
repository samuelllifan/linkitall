export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="flex w-full flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <span className="font-medium text-foreground">linkitall</span>
        <span>
          © {new Date().getFullYear()} linkitall. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
