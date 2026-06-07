import { DeviceSelector } from "./DeviceSelector";

export function StatusBar() {
  return (
    <footer className="bg-surface-container-lowest fixed bottom-0 right-0 w-[calc(100%-280px)] h-8 border-t border-outline-variant flex items-center justify-between px-md z-40 text-label-sm">
      <DeviceSelector />
      <div className="flex items-center gap-md text-[11px] font-medium">
        <a href="#" className="text-on-surface-variant hover:text-primary transition-colors">
          Documentation
        </a>
        <a href="#" className="text-on-surface-variant hover:text-primary transition-colors">
          System Status
        </a>
      </div>
    </footer>
  );
}
