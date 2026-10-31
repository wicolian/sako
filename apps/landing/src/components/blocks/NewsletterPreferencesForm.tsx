'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/form/input';
import { Button } from '@/components/ui/buttons/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/cards/card';
import Link from 'next/link';

export function NewsletterPreferencesForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;

    setErrorMsg('');
    setStatus('loading');

    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
        setErrorMsg(data?.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong');
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl">Unsubscribe</CardTitle>
        <p className="text-sm text-neutral-600 mt-1">
          Enter your email to unsubscribe from Sako newsletter and design ops updates. You will no longer receive these emails.
        </p>
      </CardHeader>
      <CardContent>
        {status === 'success' ? (
          <div className="py-6 text-center">
            <p className="text-lg font-medium text-[#9AE83E] mb-2">
              You&apos;ve been unsubscribed.
            </p>
            <p className="text-sm text-neutral-600">
              You will no longer receive our newsletter. Changed your mind?{' '}
              <Link href="/" className="text-[#9AE83E] hover:underline">
                Resubscribe from our homepage
              </Link>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleUnsubscribe} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === 'loading'}
              error={errorMsg}
            />
            <Button
              type="submit"
              disabled={status === 'loading'}
              variant="outline"
              className="w-full py-3"
            >
              {status === 'loading' ? 'Unsubscribing…' : 'Unsubscribe'}
            </Button>
          </form>
        )}
        <p className="mt-6 text-xs text-neutral-500 text-center">
          <Link href="/legal/privacy" className="underline hover:text-neutral-700">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/contact" className="underline hover:text-neutral-700">
            Contact us
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
