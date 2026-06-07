export function StatusBar() {
  return (
    <footer className="bg-surface-container-lowest fixed bottom-0 right-0 w-[calc(100%-280px)] h-8 border-t border-outline-variant flex items-center justify-between px-md z-40 text-label-sm">
      <div className="text-on-surface-variant truncate text-[11px] flex items-center gap-2 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        Environment: detecting devices…
      </div>
      <div className="flex items-center gap-md text-[11px] font-medium">
        <a href="#" className="text-on-surface-variant hover:text-primary">
          Documentation
        </a>
        <a href="#" className="text-on-surface-variant hover:text-primary">
          System Status
        </a>
      </div>
    </footer>
  );
}
