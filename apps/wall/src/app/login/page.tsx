'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push('/wall');
      } else {
        setError(true);
        setTimeout(() => setError(false), 3000);
      }
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decor background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,var(--primary)_0%,transparent_50%)] opacity-5 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <Card className="w-full max-w-md p-8 shadow-2xl relative z-10 animate-slide-in backdrop-blur-sm bg-card/90 m-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Image
              src="/sako-white.svg"
              alt="Sako"
              width={48}
              height={48}
              className="opacity-90"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Sign in to Sako Wall</h1>
          <p className="text-muted-foreground text-sm">Private dashboard. Enter the shared password.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
              placeholder="Password"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
              Incorrect password. Try again.
            </div>
          )}

          <Button type="submit" className="w-full shadow-lg shadow-primary/20" disabled={isLoading}>
            {isLoading ? 'Unlocking...' : 'Unlock'}
          </Button>

          <div className="text-center pt-2">
            <span className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors">
              Need access? Contact admin
            </span>
          </div>
        </form>
        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Secure Environment</p>
        </div>
      </Card>
    </div>
  );
}
