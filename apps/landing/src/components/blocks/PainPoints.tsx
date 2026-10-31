import { Check, X } from "lucide-react";
import { Marquee } from "@/components/ui/visuals/marquee";
import { patterns } from "@/lib/design-tokens";

interface PainPointItem {
  text: string;
  type?: 'check' | 'x';
}

interface PainPointsProps {
  title?: string;
  subtitle?: string;
  variant?: 'positive' | 'negative' | 'split' | 'marquee';
  items?: PainPointItem[];
  // For split variant
  positiveTitle?: string;
  positiveItems?: string[];
  negativeTitle?: string;
  negativeItems?: string[];
}

export function PainPoints({
  title,
  subtitle,
  variant = 'negative',
  items,
  positiveTitle,
  positiveItems,
  negativeTitle,
  negativeItems,
}: PainPointsProps) {
  if (variant === 'marquee') {
    const allItems = items || [];
    const firstHalf = allItems.slice(0, Math.ceil(allItems.length / 2));
    const secondHalf = allItems.slice(Math.ceil(allItems.length / 2));

    return (
      <section className={patterns.section}>
        <div className="w-full">
          {(title || subtitle) && (
            <div className="text-center mb-12 px-6">
              {title && <h2 className={`${patterns.heading2} mb-4`}>{title}</h2>}
              {subtitle && <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>{subtitle}</p>}
            </div>
          )}
          
          <div className="relative flex flex-col items-center justify-center overflow-hidden py-8 w-full">
            <div className="w-full group">
              <Marquee pauseOnHover className="[--duration:20s]">
                {firstHalf.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-3 bg-white border border-gray-100 rounded-full px-6 py-3 shadow-sm mx-2"
                  >
                    {item.type === 'check' ? (
                      <Check className="w-4 h-4 text-[#9AE83E]" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{item.text}</span>
                  </div>
                ))}
              </Marquee>
            </div>
            <div className="w-full group mt-4">
              <Marquee reverse pauseOnHover className="[--duration:25s]">
                {secondHalf.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-3 bg-white border border-gray-100 rounded-full px-6 py-3 shadow-sm mx-2"
                  >
                    {item.type === 'check' ? (
                      <Check className="w-4 h-4 text-[#9AE83E]" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{item.text}</span>
                  </div>
                ))}
              </Marquee>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'split') {
    return (
      <section className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          {(title || subtitle) && (
            <div className="text-center mb-12">
              {title && <h2 className="text-3xl sm:text-4xl font-medium text-black tracking-tight mb-4">{title}</h2>}
              {subtitle && <p className="text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Positive side */}
            <div className="bg-[#9AE83E]/10 border border-[#9AE83E]/30 rounded-3xl p-8">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                {positiveTitle || "Choose Sako If..."}
              </h3>
              <ul className="space-y-4">
                {positiveItems?.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Negative side */}
            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <X className="w-5 h-5 text-gray-400" />
                {negativeTitle || "Consider Alternatives If..."}
              </h3>
              <ul className="space-y-4">
                {negativeItems?.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <X className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  const isPositive = variant === 'positive';
  
  return (
    <section className="py-24 px-6">
      <div className="max-w-[800px] mx-auto">
        {title && (
          <h2 className="text-2xl sm:text-3xl font-medium text-black tracking-tight mb-8 text-center">
            {title}
          </h2>
        )}
        
        <div className={`rounded-3xl p-8 ${isPositive ? 'bg-[#9AE83E]/10 border border-[#9AE83E]/30' : 'bg-gray-50 border border-gray-200'}`}>
          <ul className="space-y-4">
            {items?.map((item, i) => {
              const showCheck = item.type === 'check' || (isPositive && !item.type);
              return (
                <li key={i} className="flex gap-3 text-sm">
                  {showCheck ? (
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <span className="text-gray-700">{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}


