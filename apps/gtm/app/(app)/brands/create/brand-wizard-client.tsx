'use client'

/**
 * Brand Creation Wizard Client Component
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  workspaceId: string
}

const INDUSTRIES = [
  'Technology', 'SaaS', 'E-commerce', 'Healthcare', 'Finance',
  'Education', 'Marketing', 'Design', 'Real Estate', 'Food & Beverage',
  'Travel', 'Entertainment', 'Fitness', 'Fashion', 'Other',
]

export function BrandWizardClient({ workspaceId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')

  const [primaryColor, setPrimaryColor] = useState('#3b82f6')
  const [secondaryColor, setSecondaryColor] = useState('#1e293b')
  const [accentColor, setAccentColor] = useState('#8b5cf6')
  const [backgroundColor, setBackgroundColor] = useState('#0f172a')
  const [textColor, setTextColor] = useState('#f8fafc')

  const [headingFont, setHeadingFont] = useState('Inter')
  const [bodyFont, setBodyFont] = useState('Inter')

  const [formality, setFormality] = useState(50)
  const [energy, setEnergy] = useState(50)
  const [bannedTerms, setBannedTerms] = useState('')
  const [preferredTerms, setPreferredTerms] = useState('')
  const [keyMessages, setKeyMessages] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    try {
      // 1. Create brand
      const brandRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          website_url: website || '',
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          background_color: backgroundColor,
          text_color: textColor,
          font_family: bodyFont,
          font_heading: headingFont,
          voice: formality > 70 ? 'formal' : formality < 30 ? 'casual' : 'balanced',
          tone_attributes: [
            energy > 70 ? 'energetic' : energy < 30 ? 'calm' : 'balanced',
            industry || 'general',
          ],
          key_messages: keyMessages
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          preferred_terms: preferredTerms
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          banned_terms: bannedTerms
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      })

      if (!brandRes.ok) throw new Error('Failed to create brand')
      const { brand } = await brandRes.json()

      // 2. Create brand memory
      const memoryRes = await fetch('/api/brand-memory/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          source: 'user_upload',
          colors: [
            { value: primaryColor, role: 'primary', format: 'hex' },
            { value: secondaryColor, role: 'secondary', format: 'hex' },
            { value: accentColor, role: 'accent', format: 'hex' },
            { value: backgroundColor, role: 'background', format: 'hex' },
            { value: textColor, role: 'text', format: 'hex' },
          ],
          fonts: [
            { family: headingFont, role: 'heading' },
            { family: bodyFont, role: 'body' },
          ],
          tone: {
            formality: Number((formality / 100).toFixed(2)),
            energy: Number((energy / 100).toFixed(2)),
          },
          keyMessages: keyMessages
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          preferredTerms: preferredTerms
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          bannedTerms: bannedTerms
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      })

      if (!memoryRes.ok) throw new Error('Failed to save brand memory')

      router.push(`/brands/${brand.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Step 1: Basic Info */}
      {step >= 1 && (
        <section className="p-6 bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold">1. Basic Information</h2>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Brand Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50 focus:outline-none focus:border-blue-500"
              placeholder="Acme Inc."
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50"
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Website (optional)</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50 focus:outline-none focus:border-blue-500"
              placeholder="https://example.com"
            />
          </div>

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              Next: Colors & Fonts
            </button>
          )}
        </section>
      )}

      {/* Step 2: Visual Identity */}
      {step >= 2 && (
        <section className="p-6 bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold">2. Visual Identity</h2>

          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Primary', value: primaryColor, setter: setPrimaryColor },
              { label: 'Secondary', value: secondaryColor, setter: setSecondaryColor },
              { label: 'Accent', value: accentColor, setter: setAccentColor },
              { label: 'Background', value: backgroundColor, setter: setBackgroundColor },
              { label: 'Text', value: textColor, setter: setTextColor },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-border/50"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full bg-muted/50 text-foreground/90 text-xs px-2 py-1 rounded border border-border/50"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Heading Font</label>
              <input
                type="text"
                value={headingFont}
                onChange={(e) => setHeadingFont(e.target.value)}
                className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50"
                placeholder="Inter"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Body Font</label>
              <input
                type="text"
                value={bodyFont}
                onChange={(e) => setBodyFont(e.target.value)}
                className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50"
                placeholder="Inter"
              />
            </div>
          </div>

          {/* Preview */}
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor, color: textColor }}
          >
            <h3 style={{ fontFamily: headingFont, color: primaryColor, fontSize: '24px', marginBottom: '8px' }}>
              Preview Heading
            </h3>
            <p style={{ fontFamily: bodyFont, fontSize: '14px', opacity: 0.8 }}>
              This is how your brand typography and colors will look.
            </p>
            <button
              style={{
                backgroundColor: primaryColor,
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '6px',
                marginTop: '12px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
              }}
            >
              Sample CTA
            </button>
          </div>

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500"
            >
              Next: Voice & Messaging
            </button>
          )}
        </section>
      )}

      {/* Step 3: Voice & Messaging */}
      {step >= 3 && (
        <section className="p-6 bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold">3. Voice & Messaging</h2>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Formality: {formality < 30 ? 'Casual' : formality > 70 ? 'Formal' : 'Balanced'}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formality}
              onChange={(e) => setFormality(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/80 mt-1">
              <span>Casual</span>
              <span>Formal</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Energy: {energy < 30 ? 'Calm' : energy > 70 ? 'Energetic' : 'Balanced'}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={energy}
              onChange={(e) => setEnergy(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/80 mt-1">
              <span>Calm</span>
              <span>Energetic</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Key Messages (one per line)</label>
            <textarea
              value={keyMessages}
              onChange={(e) => setKeyMessages(e.target.value)}
              className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50 h-24 resize-none"
              placeholder="Our product saves teams 10 hours per week&#10;Trusted by 500+ companies&#10;Built for modern marketers"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Preferred Terms</label>
              <textarea
                value={preferredTerms}
                onChange={(e) => setPreferredTerms(e.target.value)}
                className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50 h-20 resize-none"
                placeholder="innovative, seamless, powerful"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Banned Terms</label>
              <textarea
                value={bannedTerms}
                onChange={(e) => setBannedTerms(e.target.value)}
                className="w-full bg-muted/50 text-foreground px-3 py-2 rounded-lg border border-border/50 h-20 resize-none"
                placeholder="cheap, basic, simple"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Creating Brand...' : 'Create Brand'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800/30 rounded text-sm text-red-400">
              {error}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
