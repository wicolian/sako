import { Check, X } from "lucide-react";
import Link from "next/link";
import { patterns } from "@/lib/design-tokens";

// Parse {serif} markers in title for Playfair Display
function parseTitleWithSerif(title: string) {
  const parts = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(title)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: title.slice(lastIndex, match.index), serif: false });
    }
    parts.push({ text: match[1], serif: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < title.length) {
    parts.push({ text: title.slice(lastIndex), serif: false });
  }

  return parts.length > 0 ? parts : [{ text: title, serif: false }];
}

interface TableValue {
  text: string;
  check?: boolean;
}

interface ComparisonTableProps {
  title?: string;
  subtitle?: string;
  highlightColumn?: number;
  columns: string[];
  rows: Array<{
    label: string;
    values: TableValue[];
  }>;
  ctas?: {
    primary: { label: string; href: string };
    secondary?: { label: string; href: string };
  };
}

function CTALink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith('http')) {
    return <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

export function ComparisonTable({
  title,
  subtitle,
  highlightColumn,
  columns = [],
  rows = [],
  ctas,
}: ComparisonTableProps) {
  const titleParts = title ? parseTitleWithSerif(title) : null;
  return (
    <section className="py-24 px-6">
      <div className="max-w-[1200px] mx-auto">
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && <h2 className={`${patterns.heading2} mb-4`}>
              {titleParts?.map((part, i) =>
                part.serif ? (
                  <span key={i} className="font-serif italic">{part.text}</span>
                ) : (
                  <span key={i}>{part.text}</span>
                )
              )}
            </h2>}
            {subtitle && <p className="text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
          </div>
        )}
        
        {/* Mobile-friendly scrollable container with sticky first column */}
        <div className="relative rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr>
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className={`px-6 py-4 text-left text-sm font-semibold whitespace-nowrap ${
                        highlightColumn === i
                          ? 'bg-[#9AE83E] text-black'
                          : 'bg-gray-100 text-gray-700'
                      } ${i === 0 ? 'sticky left-0 z-10 bg-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-gray-100 last:border-0">
                    <td className={`px-6 py-4 text-sm font-medium text-black bg-white sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]`}>
                      {row.label}
                    </td>
                    {row.values.map((val, valIndex) => (
                      <td
                        key={valIndex}
                        className={`px-6 py-4 text-sm ${
                          highlightColumn === valIndex + 1
                            ? 'bg-[#9AE83E]/20 backdrop-blur-sm'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {val.check !== undefined && (
                            val.check ? (
                              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                            )
                          )}
                          <span className={val.check === false ? 'text-gray-400' : 'text-gray-700'}>
                            {val.text}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Scroll indicator for mobile */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden" />
        </div>
        
        {ctas && (
          <div className="flex flex-wrap justify-center gap-4 mt-12">
            <CTALink
              href={ctas.primary.href}
              className="px-8 py-3.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-all"
            >
              {ctas.primary.label}
            </CTALink>
            {ctas.secondary && (
              <CTALink
                href={ctas.secondary.href}
                className="px-8 py-3.5 bg-white border border-gray-200 text-sm font-medium rounded-full hover:bg-gray-50 transition-all"
              >
                {ctas.secondary.label}
              </CTALink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}


