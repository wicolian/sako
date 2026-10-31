/**
 * Lazy-loaded chart components
 * 
 * Usage:
 * Instead of importing recharts directly:
 *   import { LineChart, Line, XAxis, YAxis } from 'recharts';
 * 
 * Use this wrapper:
 *   import { LazyLineChart } from '@/components/lazy/LazyCharts';
 *   <Suspense fallback={<ChartSkeleton />}>
 *     <LazyLineChart data={data} ... />
 *   </Suspense>
 */

import React, { Suspense, ComponentProps } from 'react';

// Lazy load the entire recharts module
const RechartsModule = React.lazy(() => import('recharts'));

// Type helpers
type RechartsType = typeof import('recharts');

// Skeleton for charts while loading
export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <div 
    className="animate-pulse bg-[color:var(--muted)] rounded-lg" 
    style={{ height }} 
  />
);

// Lazy wrapper component that loads recharts on demand
export const LazyChart: React.FC<{
  children: (recharts: RechartsType) => React.ReactNode;
  height?: number;
}> = ({ children, height = 300 }) => {
  const [recharts, setRecharts] = React.useState<RechartsType | null>(null);

  React.useEffect(() => {
    import('recharts').then(setRecharts);
  }, []);

  if (!recharts) {
    return <ChartSkeleton height={height} />;
  }

  return <>{children(recharts)}</>;
};

export default LazyChart;
