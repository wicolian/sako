import React from 'react';

interface PlaceholderProps {
  title: string;
  subtitle: string;
  onNavigate: (route: string) => void;
}

export const Placeholder: React.FC<PlaceholderProps> = ({ title, subtitle, onNavigate }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">{subtitle}</p>
        <h2 className="text-[22px] tracking-tight font-semibold">{title}</h2>
      </header>

      <div className="bg-white rounded-2xl border border-[#e1eaef] shadow-sm p-8 md:p-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-[#e3ecf6] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full bg-[color:var(--primary)]/20"></div>
        </div>
        <div>
          <h3 className="text-[18px] font-semibold text-[#1a1a1a] mb-1">{title} Screen</h3>
          <p className="text-[13px] text-neutral-600">This screen is coming soon. The visual design will match the other screens.</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:bg-[color:var(--primary)]/90 transition" onClick={() => onNavigate('/')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};
