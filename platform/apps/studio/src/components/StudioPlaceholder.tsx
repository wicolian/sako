import React from 'react';

interface StudioPlaceholderProps {
  title: string;
  subtitle: string;
  onNavigate: (route: string) => void;
  message?: string;
}

export const StudioPlaceholder: React.FC<StudioPlaceholderProps> = ({ title, subtitle, onNavigate, message }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">{subtitle}</p>
        <h2 className="text-[22px] tracking-tight font-semibold">{title}</h2>
      </header>

      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 md:p-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-[color:var(--accent)]/40 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full bg-[color:var(--primary)]/20"></div>
        </div>
        <div>
          <h3 className="text-[18px] font-semibold text-[color:var(--foreground)] mb-1">{title} Screen</h3>
          <p className="text-[13px] text-[color:var(--muted-foreground)]">{message || 'admin view · coming soon'}</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] text-[13px] font-medium hover:bg-[color:var(--secondary)]/90 transition" onClick={() => onNavigate('/studio/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};
