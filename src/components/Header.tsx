export function Header({ trailing }: { trailing?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-4 border-b hairline bg-surface/80 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="font-display text-20 tracking-tight font-semibold text-ink">NAVEXA</span>
        <span className="hidden sm:inline-block h-4 w-px bg-rule" />
        <span className="hidden sm:inline-flex items-center gap-1.5 text-12 text-slate font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Tamil Nadu
        </span>
      </div>
      <div className="flex items-center gap-4 text-13 text-slate tabular">
        {trailing ?? <span className="text-12 text-slate font-medium">Regulatory Intelligence</span>}
      </div>
    </header>
  );
}
