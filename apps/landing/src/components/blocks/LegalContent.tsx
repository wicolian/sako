interface LegalContentProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalContent({ title, lastUpdated, children }: LegalContentProps) {
  return (
    <section className="py-16 px-6">
      <div className="max-w-[800px] mx-auto">
        {/* Published date at the very top */}
        {lastUpdated && (
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-6">
            Published: {lastUpdated}
          </p>
        )}
        
        <div className="mb-12">
          <h1 className="text-4xl font-semibold text-black tracking-tight">{title}</h1>
        </div>
        
        <div className="text-gray-600 leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  );
}


