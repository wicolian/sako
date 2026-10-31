'use client';

import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/form/input';
import { Button } from '@/components/ui/buttons/button';
import { trackFormStart, trackFormSubmit } from '@/lib/analytics';
import { getUTMContext } from '@/lib/utm-store';
import { footerCopy } from '@/config/landing';
import Link from 'next/link';

interface NewsletterFormProps {
  variant?: 'footer' | 'standalone' | 'dark';
  heading?: string;
  description?: string;
  ctaLabel?: string;
  socialProof?: string;
}

export function NewsletterForm({
  variant = 'footer',
  heading = footerCopy.newsletter?.heading ?? 'Get design ops updates',
  description = footerCopy.newsletter?.description ?? 'Practical tips on shipping GTM faster. No spam.',
  ctaLabel = footerCopy.newsletter?.ctaLabel ?? 'Subscribe',
  socialProof,
}: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const hasTrackedStart = useRef(false);

  const handleFocus = useCallback(() => {
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackFormStart('newsletter');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;

    setErrorMsg('');
    setStatus('loading');

    const utm = getUTMContext();
    const payload = {
      email: email.trim(),
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_content: utm.utm_content ?? null,
      utm_term: utm.utm_term ?? null,
    };

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('success');
        setEmail('');
        trackFormSubmit('newsletter', true);
      } else {
        setStatus('error');
        setErrorMsg(data?.error || 'Something went wrong');
        trackFormSubmit('newsletter', false);
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong');
      trackFormSubmit('newsletter', false);
    }
  };

  const isFooter = variant === 'footer';
  const isDark = variant === 'dark';

  return (
    <div className={isFooter ? 'w-full' : isDark ? 'w-full' : 'max-w-md'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          {heading && (
            <h3 className={`text-base font-semibold mb-1 ${isDark || isFooter ? 'text-white' : 'text-gray-900'}`}>
              {heading}
            </h3>
          )}
          {description && (
            <p className={`text-sm mb-3 ${isDark || isFooter ? 'text-neutral-400' : 'text-gray-500'}`}>
              {description}
            </p>
          )}
        </div>

        {status === 'success' ? (
          <p className="text-sm text-[#9AE83E] font-medium">
            Thanks! Check your inbox.
          </p>
        ) : (
          <>
            <div
              className={
                isFooter || isDark
                  ? 'flex flex-col sm:flex-row gap-3'
                  : 'space-y-3'
              }
            >
              <Input
                id={`newsletter-email-${variant}`}
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={handleFocus}
                required
                disabled={status === 'loading'}
                error={errorMsg}
                className={
                  isFooter || isDark
                    ? 'flex-1 text-white placeholder:text-neutral-500 border-neutral-700 bg-neutral-900/50 focus:border-[#9AE83E] focus:ring-[#9AE83E]/50'
                    : ''
                }
              />
              <Button
                type="submit"
                disabled={status === 'loading'}
                className={
                  isFooter || isDark
                    ? 'px-6 py-2.5 bg-[#9AE83E] text-black font-semibold rounded-lg hover:bg-[#8ECC2D] shrink-0'
                    : 'w-full sm:w-auto'
                }
              >
                {status === 'loading' ? 'Subscribing…' : ctaLabel}
              </Button>
            </div>
            {socialProof && (
              <p className={`text-xs ${isDark || isFooter ? 'text-neutral-500' : 'text-neutral-600'}`}>
                {socialProof}
              </p>
            )}
            <p className={`text-[10px] ${isDark || isFooter ? 'text-neutral-500' : 'text-neutral-400'}`}>
              By subscribing you agree to our{' '}
              <Link
                href="/legal/privacy"
                className="text-neutral-500 hover:text-white underline"
              >
                Privacy Policy
              </Link>
              {' '}(<Link href="/newsletter/preferences" className="text-neutral-500 hover:text-white underline">unsubscribe</Link> anytime). We use Brevo to send emails.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
