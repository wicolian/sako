import { patterns } from "@/lib/design-tokens";
import { NumberTicker } from "@/components/ui/visuals/number-ticker";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCoin,
  IconDiscount2,
  IconReceipt2,
  IconUserPlus,
  IconTrendingUp,
  IconTrendingDown,
  IconUsers,
  IconTarget,
  IconClock,
  IconShield,
  IconBolt,
} from '@tabler/icons-react';

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

interface MetricItem {
  value: string;
  label: string;
  description?: string;
  type?: 'default' | 'featured';
}

interface StatsGridItem {
  title: string;
  icon: string;
  value: string;
  diff?: number;
  description?: string;
}

interface MetricCardsProps {
  columns?: 3 | 4;
  items: MetricItem[] | StatsGridItem[];
  title?: string;
  subtitle?: string;
  layout?: 'grid' | 'bento';
  variant?: 'default' | 'elevated' | 'minimal' | 'transparent';
  style?: 'horizontal' | 'cards';
  compact?: boolean;
}

// Helper to parse metric values and animate numbers
function MetricValue({ value }: { value: string }) {
  // Extract number and suffix (e.g., "48hrs" -> 48, "hrs")
  const match = value.match(/^([<>≤≥]?)(\d+(?:\.\d+)?)(.*)/);
  
  if (match) {
    const [, prefix, numStr, suffix] = match;
    const num = parseFloat(numStr);
    
    return (
      <>
        {prefix}
        <NumberTicker value={num} className="tabular-nums" />
        {suffix}
      </>
    );
  }
  
  // Fallback for non-numeric values
  return <>{value}</>;
}

// Icon mapping for stats grid
const iconMap: Record<string, React.ComponentType<any>> = {
  user: IconUserPlus,
  users: IconUsers,
  discount: IconDiscount2,
  receipt: IconReceipt2,
  coin: IconCoin,
  target: IconTarget,
  clock: IconClock,
  shield: IconShield,
  zap: IconBolt,
  trendingUp: IconTrendingUp,
  trendingDown: IconTrendingDown,
};

export function MetricCards({
  items = [],
  title,
  subtitle,
  variant = 'transparent',
  style = 'horizontal',
  compact = false
}: MetricCardsProps) {
  const titleParts = title ? parseTitleWithSerif(title) : null;

  // Render horizontal layout (original style)
  if (style === 'horizontal') {
    return (
      <section className={`${compact ? 'py-12 px-6' : patterns.section} ${variant === 'transparent' ? 'bg-transparent' : 'bg-gray-50'}`}>
        <div className={patterns.container}>
          {(title || subtitle) && (
            <div className="text-center mb-10">
              {title && (
                <h2 className={`${patterns.heading2} mb-3`}>
                  {titleParts?.map((part, i) =>
                    part.serif ? (
                      <span key={i} className="font-serif italic font-normal">{part.text}</span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
                </h2>
              )}
              {subtitle && (
                <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Single line horizontal layout - scrollable on mobile */}
          <div className="flex items-stretch justify-center gap-4 sm:gap-8 overflow-x-auto pb-2 -mx-6 px-6 sm:mx-0 sm:px-0 sm:overflow-visible">
            {(items as MetricItem[]).map((item, index) => (
              <div
                key={index}
                className="flex-shrink-0 flex flex-col items-center text-center min-w-[120px] sm:min-w-0 sm:flex-1"
              >
                {/* Value and Label stacked, same size */}
                <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${item.type === 'featured' ? 'text-[#9AE83E]' : 'text-black'}`}>
                  <MetricValue value={item.value} />
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mt-1">
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-xs sm:text-sm text-gray-500 mt-2 max-w-[140px] sm:max-w-none">
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Render cards layout (new stats grid style) - only when style="cards" is set
  const statsItems = items as StatsGridItem[];
  const stats = statsItems.map((stat) => {
    const Icon = iconMap[stat.icon] || IconTarget;
    const DiffIcon = (stat.diff ?? 0) > 0 ? IconArrowUpRight : IconArrowDownRight;

    return (
      <div
        key={stat.title}
        className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
      >
        {/* Title and icon in top row */}
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {stat.title}
          </span>
          <Icon className="text-gray-400" size={22} stroke={1.5} />
        </div>

        {/* Value in middle row */}
        <div className="mt-6">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-black leading-none">
              <MetricValue value={stat.value} />
            </span>
            {stat.diff !== undefined && (
              <span className={`text-sm font-medium ${
                stat.diff > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.diff > 0 ? '+' : ''}{stat.diff}%
              </span>
            )}
          </div>
        </div>

        {/* Comparison text at bottom */}
        {stat.description && (
          <p className="text-xs text-gray-500 mt-3">
            {stat.description}
          </p>
        )}
      </div>
    );
  });

  return (
    <section className={`${compact ? 'py-12 px-6' : patterns.section} ${variant === 'transparent' ? 'bg-transparent' : 'bg-gray-50'}`}>
      <div className={patterns.container}>
        {(title || subtitle) && (
          <div className="text-center mb-10">
            {title && (
              <h2 className={`${patterns.heading2} mb-3`}>
                  {titleParts?.map((part, i) =>
                    part.serif ? (
                      <span key={i} className="font-serif italic font-normal">{part.text}</span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
              </h2>
            )}
            {subtitle && (
              <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {stats}
        </div>
      </div>
    </section>
  );
}


