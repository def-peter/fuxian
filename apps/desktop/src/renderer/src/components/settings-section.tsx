import type { ReactNode } from 'react';

/** Shared heading, description, and action alignment for settings sections. */
export function SettingsSection({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h3 id={id} className="text-sm font-medium">
            {title}
          </h3>
          {description ? (
            <div className="mt-1.5 text-sm leading-6 text-fg-secondary">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
