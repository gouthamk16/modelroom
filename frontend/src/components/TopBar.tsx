export function TopBar({ title }: { title: string }) {
  return (
    <header className="bg-surface fixed top-0 right-0 w-[calc(100%-280px)] h-16 border-b border-outline-variant flex justify-between items-center px-lg z-40 shadow-sm">
      <nav className="flex h-full items-end">
        <ul className="flex gap-lg h-full">
          <li className="h-full flex items-end">
            <span className="text-primary font-bold border-b-2 border-primary pb-1 uppercase text-label-sm">
              {title}
            </span>
          </li>
        </ul>
      </nav>
      <div className="flex items-center gap-sm">
        <button className="px-5 py-1.5 border border-outline-variant text-on-surface hover:bg-surface-variant/50 rounded-full uppercase font-semibold text-label-sm shadow-sm">
          Export
        </button>
        <button className="px-5 py-1.5 bg-primary text-on-primary font-bold rounded-full uppercase text-label-sm shadow-sm hover:brightness-110">
          Deploy
        </button>
      </div>
    </header>
  );
}
