import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";

export function AppShell({
  active,
  title,
  onNavigate,
  children,
}: {
  active: string;
  title: string;
  onNavigate: (label: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={active} onNavigate={onNavigate} />
      <div className="ml-[280px] w-[calc(100%-280px)] h-full flex flex-col relative">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto mt-16 mb-8 p-lg bg-background">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
