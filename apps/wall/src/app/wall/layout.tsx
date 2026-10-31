import { WallProvider } from '@/context/WallContext';
import { Header } from '@/components/wall/Header';
import { AlertStrip } from '@/components/wall/AlertStrip';

export default function WallLayout({ children }: { children: React.ReactNode }) {
  return (
    <WallProvider>
      <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300 relative isolate overflow-hidden">
        {/* Subtle Global Grid Background */}
        <div className="fixed inset-0 z-[-1] bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        <Header />
        <AlertStrip />
        {children}
      </div>
    </WallProvider>
  );
}
