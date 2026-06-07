import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 gap-sm">
      <div className="w-16 h-16 rounded-2xl bg-primary-container/15 flex items-center justify-center mb-xs">
        <span className="material-symbols-outlined text-primary text-[32px]">{icon}</span>
      </div>
      <h3 className="text-headline-sm font-bold text-on-surface">{title}</h3>
      <p className="text-body-md text-on-surface-variant max-w-sm">{description}</p>
      {children && <div className="mt-sm">{children}</div>}
    </div>
  );
}
