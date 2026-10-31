interface SectionDividerProps {
  variant?: 'line' | 'gradient' | 'dots';
}

export function SectionDivider({ variant = 'line' }: SectionDividerProps) {
  if (variant === 'gradient') {
    return (
      <div className="py-12">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        </div>
      </div>
    );
  }
  
  if (variant === 'dots') {
    return (
      <div className="py-12 flex justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-gray-200" />
        <div className="w-2 h-2 rounded-full bg-[#9AE83E]" />
        <div className="w-2 h-2 rounded-full bg-gray-200" />
      </div>
    );
  }
  
  return (
    <div className="py-12">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="h-px bg-gray-200" />
      </div>
    </div>
  );
}


