import React, { useState } from 'react';
import { Icon } from '../Icon';
import { FontSelector } from '../FontSelector';
import { ColorPicker } from '../ColorPicker';
import { useBrands } from '../../lib/hooks';
import { createBrand } from '../../lib/api';
import { Brand } from '../../lib/types';

interface BrandsProps {
  onNavigate: (route: string) => void;
}

export const Brands: React.FC<BrandsProps> = ({ onNavigate }) => {
  const { data: brands, loading, error, refetch } = useBrands();
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleBrandUpdated = (updated: Brand) => {
    setSelectedBrand(updated);
    refetch();
  };

  if (selectedBrand) {
    return <BrandDetail brand={selectedBrand} onBack={() => setSelectedBrand(null)} onNavigate={onNavigate} onUpdated={handleBrandUpdated} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Brand assets</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">Brands</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
        >
          + New brand
        </button>
      </header>

      {loading && (
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading brands...</p>
        </div>
      )}

      {error && (
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-red-600 dark:text-red-400 mb-2">Failed to load brands</p>
          <p className="text-[12px] text-[color:var(--muted-foreground)] mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && brands && (
        <div className="grid md:grid-cols-2 gap-4">
          {brands.length === 0 ? (
            <div className="col-span-2 bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
              <p className="text-[13px] text-[color:var(--muted-foreground)] mb-4">No brands yet. Create your first brand to get started.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
              >
                + Create first brand
              </button>
            </div>
          ) : (
            brands.map(brand => (
              <div
                key={brand.id}
                className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-5 flex flex-col gap-4 cursor-pointer hover:border-[color:var(--primary)]/40 hover:shadow-md transition"
                onClick={() => setSelectedBrand(brand)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[16px] tracking-tight font-semibold text-[color:var(--foreground)]">{brand.name}</h3>
                    </div>
                    <p className="text-[12px] text-[color:var(--muted-foreground)]">{brand.name} workspace brand</p>
                  </div>
                  <Icon name="chevron-right" className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                </div>

                <div className="space-y-3 text-[12px]">
                  {brand.colorsJson && (brand.colorsJson.primary || brand.colorsJson.secondary) && (
                    <div className="flex items-center gap-2">
                      <span className="text-[color:var(--muted-foreground)] w-20">Colors:</span>
                      <div className="flex items-center gap-2">
                        {brand.colorsJson.primary && (
                          <div className="flex items-center gap-1">
                            <span className="h-5 w-5 rounded-full border border-[color:var(--border)]" style={{ backgroundColor: brand.colorsJson.primary }}></span>
                            <span className="text-[11px] text-[color:var(--muted-foreground)]">{brand.colorsJson.primary}</span>
                          </div>
                        )}
                        {brand.colorsJson.secondary && (
                          <div className="flex items-center gap-1">
                            <span className="h-5 w-5 rounded-full border border-[color:var(--border)]" style={{ backgroundColor: brand.colorsJson.secondary }}></span>
                            <span className="text-[11px] text-[color:var(--muted-foreground)]">{brand.colorsJson.secondary}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {brand.toneTags && brand.toneTags.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[color:var(--muted-foreground)] w-20">Tone:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {brand.toneTags.map(tag => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/60 text-[11px] text-[color:var(--primary)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-dashed border-[color:var(--border)] flex items-center justify-between text-[12px]">
                  <span className="text-[color:var(--muted-foreground)]">Created {new Date(brand.createdAt).toLocaleDateString()}</span>
                  <button className="text-[color:var(--primary)] hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedBrand(brand); }}>
                    View details →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateBrandModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
};

// Create Brand Modal
const CreateBrandModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Brand name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createBrand({ name: name.trim() });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create brand');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-semibold text-[color:var(--foreground)]">Create new brand</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-[color:var(--accent)] flex items-center justify-center">
            <Icon name="x" className="h-4 w-4 text-[color:var(--muted-foreground)]" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-2 block">
              Brand name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E.g. Acme Corp"
              className="w-full px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create brand'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Tone tag options
const TONE_OPTIONS = ['Professional', 'Playful', 'Serious', 'Friendly', 'Bold', 'Minimal', 'Luxury', 'Technical', 'Casual', 'Formal'];

// Hero style options
const HERO_STYLE_OPTIONS = [
  { value: 'centered', label: 'Centered' },
  { value: 'split', label: 'Split (Text + Image)' },
  { value: 'fullwidth', label: 'Full Width' },
  { value: 'minimal', label: 'Minimal' },
];

// CTA style options
const CTA_STYLE_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'outline', label: 'Outline' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'minimal', label: 'Minimal' },
];

// Brand detail view with full Composer system
const BrandDetail: React.FC<{ brand: Brand; onBack: () => void; onNavigate: (route: string) => void; onUpdated: (brand: Brand) => void }> = ({ brand, onBack, onUpdated }) => {
  // Basic info
  const [brandName, setBrandName] = React.useState('');
  const [guidelines, setGuidelines] = React.useState('');
  const [voiceGuidelines, setVoiceGuidelines] = React.useState('');
  
  // Colors
  const [primaryColor, setPrimaryColor] = React.useState('');
  const [secondaryColor, setSecondaryColor] = React.useState('');
  const [accentColor, setAccentColor] = React.useState('');
  const [gradients, setGradients] = React.useState<Array<{ from: string; to: string }>>([]);
  
  // Typography
  const [headingFont, setHeadingFont] = React.useState('');
  const [bodyFont, setBodyFont] = React.useState('');
  const [fontScale, setFontScale] = React.useState<'small' | 'medium' | 'large'>('medium');
  
  // Tone
  const [toneTags, setToneTags] = React.useState<string[]>([]);
  
  // Layout preferences
  const [heroStyle, setHeroStyle] = React.useState<string>('centered');
  const [ctaStyle, setCtaStyle] = React.useState<string>('solid');
  
  // UI state
  const [activeTab, setActiveTab] = React.useState<'basic' | 'colors' | 'typography' | 'layout'>('basic');
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [initialState, setInitialState] = React.useState<any>(null);

  // Initialize state when brand loads
  React.useEffect(() => {
    const state = {
      brandName: brand.name || '',
      guidelines: brand.guidelines || '',
      voiceGuidelines: (brand as any).voiceGuidelines || '',
      primaryColor: brand.primaryColor || brand.colorsJson?.primary || '',
      secondaryColor: brand.secondaryColor || brand.colorsJson?.secondary || '',
      accentColor: brand.accentColor || brand.colorsJson?.accent || '',
      gradients: brand.colorsJson?.gradients || [],
      headingFont: brand.typographyJson?.headingFont || '',
      bodyFont: brand.typographyJson?.bodyFont || '',
      fontScale: brand.typographyJson?.scale || 'medium',
      toneTags: brand.toneTags || [],
      heroStyle: (brand as any).brandProfileJson?.heroStyle || 'centered',
      ctaStyle: (brand as any).brandProfileJson?.ctaStyle || 'solid',
    };

    setBrandName(state.brandName);
    setGuidelines(state.guidelines);
    setVoiceGuidelines(state.voiceGuidelines);
    setPrimaryColor(state.primaryColor);
    setSecondaryColor(state.secondaryColor);
    setAccentColor(state.accentColor);
    setGradients(state.gradients);
    setHeadingFont(state.headingFont);
    setBodyFont(state.bodyFont);
    setFontScale(state.fontScale);
    setToneTags(state.toneTags);
    setHeroStyle(state.heroStyle);
    setCtaStyle(state.ctaStyle);
    setInitialState(state);
  }, [brand]);

  const hasChanges = () => {
    if (!initialState) return false;
    return (
      brandName !== initialState.brandName ||
      guidelines !== initialState.guidelines ||
      voiceGuidelines !== initialState.voiceGuidelines ||
      primaryColor !== initialState.primaryColor ||
      secondaryColor !== initialState.secondaryColor ||
      accentColor !== initialState.accentColor ||
      JSON.stringify(gradients) !== JSON.stringify(initialState.gradients) ||
      headingFont !== initialState.headingFont ||
      bodyFont !== initialState.bodyFont ||
      fontScale !== initialState.fontScale ||
      JSON.stringify(toneTags) !== JSON.stringify(initialState.toneTags) ||
      heroStyle !== initialState.heroStyle ||
      ctaStyle !== initialState.ctaStyle
    );
  };

  const toggleToneTag = (tag: string) => {
    setToneTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addGradient = () => {
    setGradients(prev => [...prev, { from: primaryColor || '#000000', to: secondaryColor || '#ffffff' }]);
  };

  const removeGradient = (index: number) => {
    setGradients(prev => prev.filter((_, i) => i !== index));
  };

  const updateGradient = (index: number, field: 'from' | 'to', value: string) => {
    setGradients(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const handleSave = async () => {
    if (!hasChanges()) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const { updateBrand } = await import('../../lib/api');

      const updates: any = {
        name: brandName,
        guidelines,
        voiceGuidelines,
        primaryColor,
        secondaryColor,
        accentColor,
        colorsJson: {
          primary: primaryColor,
          secondary: secondaryColor,
          accent: accentColor,
          gradients,
        },
        typographyJson: {
          headingFont,
          bodyFont,
          scale: fontScale,
        },
        brandProfileJson: {
          heroStyle,
          ctaStyle,
        },
        toneTags,
      };

      const updatedBrand = await updateBrand(brand.id, updates);
      onUpdated(updatedBrand);
      
      // Update initial state to reflect saved values
      setInitialState({
        brandName,
        guidelines,
        voiceGuidelines,
        primaryColor,
        secondaryColor,
        accentColor,
        gradients,
        headingFont,
        bodyFont,
        fontScale,
        toneTags,
        heroStyle,
        ctaStyle,
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || err.body?.message || 'Failed to update brand');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] mb-2">
            <Icon name="chevron-right" className="h-3 w-3 rotate-180" />
            Back to brands
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">{brandName}</h2>
            {primaryColor && (
              <div className="h-6 w-6 rounded-full border-2 border-[color:var(--border)]" style={{ backgroundColor: primaryColor }} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges() && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges() || isSaving}
            className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </header>

      {saveSuccess && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-700 px-4 py-3 text-[13px] text-green-900 dark:text-green-200">
          ✓ Brand updated successfully
        </div>
      )}

      {saveError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200">
          {saveError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[color:var(--accent)] rounded-xl w-fit">
        {(['basic', 'colors', 'typography', 'layout'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${
              activeTab === tab
                ? 'bg-[color:var(--card)] text-[color:var(--foreground)] shadow-sm'
                : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-6">
        {/* Basic Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-4">Brand Identity</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Brand name</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Tone & Voice Tags</label>
              <p className="text-[12px] text-[color:var(--muted-foreground)] mb-2">Select tags that describe your brand's personality</p>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleToneTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ${
                      toneTags.includes(tag)
                        ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                        : 'bg-[color:var(--accent)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Voice Guidelines</label>
              <p className="text-[12px] text-[color:var(--muted-foreground)] mb-2">Detailed guidelines for AI-generated copy (how should the brand "speak"?)</p>
              <textarea
                value={voiceGuidelines}
                onChange={(e) => setVoiceGuidelines(e.target.value)}
                placeholder="E.g., 'Use active voice, short sentences. Avoid jargon. Be direct but friendly. Never use exclamation marks in headlines.'"
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)] resize-none placeholder:text-[color:var(--muted-foreground)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">General Guidelines</label>
              <textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                placeholder="Overall brand guidelines, usage notes, do's and don'ts"
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)] resize-none placeholder:text-[color:var(--muted-foreground)]"
              />
            </div>
          </div>
        )}

        {/* Colors Tab */}
        {activeTab === 'colors' && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-4">Color Palette</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <ColorPicker value={primaryColor} onChange={setPrimaryColor} label="Primary Color" />
              <ColorPicker value={secondaryColor} onChange={setSecondaryColor} label="Secondary Color" />
              <ColorPicker value={accentColor} onChange={setAccentColor} label="Accent Color" />
            </div>

            {/* Color Preview */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Preview</label>
              <div className="flex gap-2">
                {primaryColor && <div className="h-12 w-12 rounded-xl border-2 border-[color:var(--border)]" style={{ backgroundColor: primaryColor }} />}
                {secondaryColor && <div className="h-12 w-12 rounded-xl border-2 border-[color:var(--border)]" style={{ backgroundColor: secondaryColor }} />}
                {accentColor && <div className="h-12 w-12 rounded-xl border-2 border-[color:var(--border)]" style={{ backgroundColor: accentColor }} />}
              </div>
            </div>

            {/* Gradients */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Gradients</label>
                <button
                  onClick={addGradient}
                  className="text-[12px] text-[color:var(--primary)] hover:underline"
                >
                  + Add gradient
                </button>
              </div>
              
              {gradients.length > 0 ? (
                <div className="space-y-3">
                  {gradients.map((gradient, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-[color:var(--accent)]">
                      <div
                        className="h-10 w-24 rounded-lg"
                        style={{ background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})` }}
                      />
                      <input
                        type="color"
                        value={gradient.from}
                        onChange={(e) => updateGradient(index, 'from', e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer"
                      />
                      <span className="text-[color:var(--muted-foreground)]">→</span>
                      <input
                        type="color"
                        value={gradient.to}
                        onChange={(e) => updateGradient(index, 'to', e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer"
                      />
                      <button
                        onClick={() => removeGradient(index)}
                        className="ml-auto text-[color:var(--muted-foreground)] hover:text-red-500"
                      >
                        <Icon name="x" className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[color:var(--muted-foreground)]">No gradients defined. Add gradients for CTAs, backgrounds, and accents.</p>
              )}
            </div>
          </div>
        )}

        {/* Typography Tab */}
        {activeTab === 'typography' && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-4">Typography Settings</p>
              <p className="text-[12px] text-[color:var(--muted-foreground)]">
                Search from popular Google Fonts or type any custom font name
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <FontSelector
                value={headingFont}
                onChange={setHeadingFont}
                label="Heading Font"
                placeholder="Search fonts (e.g., Playfair Display)..."
              />

              <FontSelector
                value={bodyFont}
                onChange={setBodyFont}
                label="Body Font"
                placeholder="Search fonts (e.g., Inter, Open Sans)..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Font Scale</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map(scale => (
                  <button
                    key={scale}
                    onClick={() => setFontScale(scale)}
                    className={`px-4 py-2 rounded-xl text-[13px] font-medium transition ${
                      fontScale === scale
                        ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                        : 'bg-[color:var(--accent)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80'
                    }`}
                  >
                    {scale.charAt(0).toUpperCase() + scale.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography Preview */}
            <div className="p-4 rounded-xl bg-[color:var(--accent)] space-y-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-2">Preview</p>
              <h3 
                className={`font-bold text-[color:var(--foreground)] ${fontScale === 'small' ? 'text-xl' : fontScale === 'large' ? 'text-3xl' : 'text-2xl'}`}
                style={{ fontFamily: headingFont || 'inherit' }}
              >
                This is a heading
              </h3>
              <p 
                className={`text-[color:var(--muted-foreground)] ${fontScale === 'small' ? 'text-sm' : fontScale === 'large' ? 'text-lg' : 'text-base'}`}
                style={{ fontFamily: bodyFont || 'inherit' }}
              >
                This is body text that shows how your typography settings will look in generated designs.
              </p>
            </div>
          </div>
        )}

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-4">Layout Preferences</p>
              <p className="text-[12px] text-[color:var(--muted-foreground)]">These preferences guide AI when generating landing pages and creatives</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Hero Section Style</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {HERO_STYLE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setHeroStyle(option.value)}
                    className={`p-3 rounded-xl text-[13px] font-medium transition text-center ${
                      heroStyle === option.value
                        ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                        : 'bg-[color:var(--accent)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">CTA Button Style</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CTA_STYLE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setCtaStyle(option.value)}
                    className={`p-3 rounded-xl text-[13px] font-medium transition text-center ${
                      ctaStyle === option.value
                        ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                        : 'bg-[color:var(--accent)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Preview */}
            <div className="p-4 rounded-xl bg-[color:var(--accent)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-3">CTA Preview</p>
              <button
                className={`px-6 py-2.5 rounded-full text-[14px] font-medium transition ${
                  ctaStyle === 'solid' ? 'text-white' :
                  ctaStyle === 'outline' ? 'bg-transparent border-2' :
                  ctaStyle === 'gradient' ? 'text-white' :
                  'bg-transparent'
                }`}
                style={{
                  backgroundColor: ctaStyle === 'solid' ? (primaryColor || 'var(--primary)') : 
                                   ctaStyle === 'gradient' ? undefined : 'transparent',
                  backgroundImage: ctaStyle === 'gradient' && gradients.length > 0 
                    ? `linear-gradient(90deg, ${gradients[0].from}, ${gradients[0].to})` 
                    : ctaStyle === 'gradient' ? `linear-gradient(90deg, ${primaryColor || '#000'}, ${secondaryColor || '#666'})` : undefined,
                  borderColor: ctaStyle === 'outline' ? (primaryColor || 'var(--primary)') : undefined,
                  color: ctaStyle === 'outline' || ctaStyle === 'minimal' ? (primaryColor || 'var(--primary)') : 'white',
                }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
