'use client';

import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/form/input';
import { Select } from '@/components/ui/form/select';
import { Button } from '@/components/ui/buttons/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/cards/card';
import { trackFormStart, trackFormSubmit, trackBusinessIntent } from '@/lib/analytics';
import { getUTMContext } from '@/lib/utm-store';

const COMPANY_SIZE_OPTIONS = [
  { value: '', label: 'Select stage' },
  { value: 'pre-seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
  { value: 'series-c-plus', label: 'Series C+' },
  { value: 'enterprise', label: 'Enterprise' },
];

const PRIMARY_NEED_OPTIONS = [
  { value: '', label: 'What do you need most?' },
  { value: 'gtm-design', label: 'GTM design (pages, ads, decks)' },
  { value: 'motion-video', label: 'Motion & video' },
  { value: 'web-builds', label: 'Web builds (Webflow/Framer)' },
  { value: 'all', label: 'All of the above' },
];

const PLAN_INTEREST_OPTIONS = [
  { value: '', label: 'Which plan interests you?' },
  { value: 'core', label: 'Core ($2,500/mo)' },
  { value: 'ops-base', label: 'Ops Base ($4,500/mo)' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'not-sure', label: 'Not sure yet' },
];

interface DemoRequestFormProps {
  socialProof?: string;
  /** Compact layout for embedding in smaller spaces */
  compact?: boolean;
}

export function DemoRequestForm({
  socialProof = 'We respond within 24 hours.',
  compact = false,
}: DemoRequestFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [primaryNeed, setPrimaryNeed] = useState('');
  const [planInterest, setPlanInterest] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const hasTrackedStart = useRef(false);

  const handleFocus = useCallback(() => {
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackFormStart('demo_request');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;

    setErrorMsg('');
    setStatus('loading');

    const utm = getUTMContext();
    const payload = {
      name: name.trim(),
      email: email.trim(),
      company: company.trim() || undefined,
      company_size: companySize || undefined,
      primary_need: primaryNeed || undefined,
      plan_interest: planInterest || undefined,
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_content: utm.utm_content ?? null,
      utm_term: utm.utm_term ?? null,
    };

    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('success');
        setName('');
        setEmail('');
        setCompany('');
        setCompanySize('');
        setPrimaryNeed('');
        setPlanInterest('');
        trackFormSubmit('demo_request', true);
        trackBusinessIntent('demo_request');
      } else {
        setStatus('error');
        setErrorMsg(data?.error || 'Something went wrong');
        trackFormSubmit('demo_request', false);
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong');
      trackFormSubmit('demo_request', false);
    }
  };

  return (
    <Card className={compact ? 'max-w-md mx-auto' : 'max-w-xl mx-auto'}>
      <CardHeader>
        <CardTitle className={compact ? 'text-lg' : 'text-xl'}>
          Book a fit check
        </CardTitle>
        <p className="text-sm text-neutral-600 mt-1">
          Quick form. We&apos;ll get back within 24 hours.
        </p>
      </CardHeader>
      <CardContent>
        {status === 'success' ? (
          <div className="py-8 text-center">
            <p className="text-lg font-medium text-[#9AE83E] mb-2">
              Thanks! We&apos;ll be in touch soon.
            </p>
            <p className="text-sm text-neutral-600">
              Check your inbox for a confirmation.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={handleFocus}
              required
              minLength={2}
              disabled={status === 'loading'}
            />
            <Input
              label="Email"
              type="email"
              placeholder="jane@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={handleFocus}
              required
              disabled={status === 'loading'}
            />
            <Input
              label="Company (optional)"
              type="text"
              placeholder="Acme Inc"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onFocus={handleFocus}
              disabled={status === 'loading'}
            />
            <Select
              label="Stage"
              options={COMPANY_SIZE_OPTIONS}
              placeholder="Select stage"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              onFocus={handleFocus}
              disabled={status === 'loading'}
            />
            <Select
              label="Primary need"
              options={PRIMARY_NEED_OPTIONS}
              placeholder="What do you need most?"
              value={primaryNeed}
              onChange={(e) => setPrimaryNeed(e.target.value)}
              onFocus={handleFocus}
              disabled={status === 'loading'}
            />
            <Select
              label="Plan interest"
              options={PLAN_INTEREST_OPTIONS}
              placeholder="Which plan interests you?"
              value={planInterest}
              onChange={(e) => setPlanInterest(e.target.value)}
              onFocus={handleFocus}
              disabled={status === 'loading'}
            />
            {errorMsg && (
              <p className="text-sm text-red-500" role="alert">
                {errorMsg}
              </p>
            )}
            <Button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 bg-[#1a1a1a] text-white hover:bg-gray-800"
            >
              {status === 'loading' ? 'Sending…' : 'Request demo'}
            </Button>
            {socialProof && (
              <p className="text-xs text-neutral-500 text-center">
                {socialProof}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
