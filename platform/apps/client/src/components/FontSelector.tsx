import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

// Popular Google Fonts - curated list covering various styles
const POPULAR_FONTS = [
  // Sans-serif
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Raleway',
  'Work Sans', 'Outfit', 'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Manrope',
  'Sora', 'Urbanist', 'Lexend', 'Figtree', 'Onest', 'Geist',
  // Display
  'Playfair Display', 'Bebas Neue', 'Oswald', 'Anton', 'Archivo Black', 'Righteous',
  'Russo One', 'Staatliches', 'Permanent Marker', 'Pacifico',
  // Serif
  'Merriweather', 'Lora', 'Roboto Slab', 'Noto Serif', 'Libre Baskerville', 'Crimson Text',
  'Cormorant Garamond', 'Bitter', 'Vollkorn', 'Source Serif Pro', 'DM Serif Display',
  // Monospace
  'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'IBM Plex Mono', 'Space Mono',
];

interface FontSelectorProps {
  value: string;
  onChange: (font: string) => void;
  label: string;
  placeholder?: string;
}

export const FontSelector: React.FC<FontSelectorProps> = ({ value, onChange, label, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [fonts, setFonts] = useState<string[]>(POPULAR_FONTS);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter fonts based on search
  const filteredFonts = fonts.filter(font =>
    font.toLowerCase().includes(search.toLowerCase())
  );

  // Load font preview when hovering or selecting
  const loadFontPreview = (fontName: string) => {
    if (loadedFonts.has(fontName)) return;
    
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    setLoadedFonts(prev => new Set(prev).add(fontName));
  };

  // Load current value's font
  useEffect(() => {
    if (value) {
      loadFontPreview(value);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (font: string) => {
    onChange(font);
    setSearch('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val); // Allow custom fonts
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
        {label}
      </label>
      
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? search || value : value}
            onChange={handleInputChange}
            onFocus={() => {
              setIsOpen(true);
              setSearch('');
            }}
            placeholder={placeholder || 'Search Google Fonts...'}
            className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            style={{ fontFamily: value || 'inherit' }}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[color:var(--accent)] rounded"
          >
            <Icon name="chevron-right" className={`h-4 w-4 text-[color:var(--muted-foreground)] transition-transform ${isOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {filteredFonts.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-[12px] text-[color:var(--muted-foreground)]">
                  No fonts found. You can type any font name.
                </p>
                {search && (
                  <button
                    onClick={() => handleSelect(search)}
                    className="mt-2 text-[12px] text-[color:var(--primary)] hover:underline"
                  >
                    Use "{search}"
                  </button>
                )}
              </div>
            ) : (
              <div className="py-1">
                {filteredFonts.slice(0, 20).map(font => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => handleSelect(font)}
                    onMouseEnter={() => loadFontPreview(font)}
                    className={`w-full px-3 py-2 text-left text-[13px] hover:bg-[color:var(--accent)] transition flex items-center justify-between ${
                      value === font ? 'bg-[color:var(--accent)]' : ''
                    }`}
                    style={{ fontFamily: font }}
                  >
                    <span>{font}</span>
                    {value === font && (
                      <Icon name="check" className="h-4 w-4 text-[color:var(--primary)]" />
                    )}
                  </button>
                ))}
                {filteredFonts.length > 20 && (
                  <p className="px-3 py-2 text-[11px] text-[color:var(--muted-foreground)] text-center border-t border-[color:var(--border)]">
                    Type to search more fonts...
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {value && (
        <p className="text-[11px] text-[color:var(--muted-foreground)]" style={{ fontFamily: value }}>
          Preview: The quick brown fox jumps over the lazy dog
        </p>
      )}
    </div>
  );
};

