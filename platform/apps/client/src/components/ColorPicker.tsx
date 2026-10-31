import React, { useState, useRef, useEffect } from 'react';

// Preset color palettes
const PRESET_COLORS = [
  // Neutrals
  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6', '#FFFFFF',
  // Reds
  '#7F1D1D', '#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FEE2E2',
  // Oranges
  '#7C2D12', '#C2410C', '#EA580C', '#F97316', '#FB923C', '#FDBA74', '#FED7AA',
  // Yellows
  '#713F12', '#A16207', '#CA8A04', '#EAB308', '#FACC15', '#FDE047', '#FEF08A',
  // Greens
  '#14532D', '#166534', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0',
  // Blues
  '#1E3A8A', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE',
  // Purples
  '#581C87', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE',
  // Pinks
  '#831843', '#BE185D', '#DB2777', '#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value || '');
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

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    // Only update parent if it's a valid color
    if (/^#([0-9A-F]{3}){1,2}$/i.test(newValue) || newValue === '') {
      onChange(newValue);
    }
  };

  const handleTextBlur = () => {
    // On blur, sync back the valid value
    if (localValue && !/^#([0-9A-F]{3}){1,2}$/i.test(localValue)) {
      setLocalValue(value || '');
    } else {
      onChange(localValue);
    }
  };

  const handlePresetClick = (color: string) => {
    setLocalValue(color);
    onChange(color);
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setLocalValue(newColor);
    onChange(newColor);
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
        {label}
      </label>
      
      <div className="relative">
        <div className="flex items-center gap-2">
          {/* Color preview button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="h-10 w-10 rounded-lg border-2 border-[color:var(--border)] cursor-pointer transition hover:border-[color:var(--primary)] flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: localValue || '#ffffff' }}
          >
            {!localValue && (
              <span className="text-[10px] text-[color:var(--muted-foreground)]">Pick</span>
            )}
          </button>
          
          {/* Hex input */}
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onFocus={() => setIsOpen(true)}
            placeholder="#000000"
            className="flex-1 px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          />
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-64 mt-2 p-3 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-lg">
            {/* Native color picker */}
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1.5 block">
                Custom Color
              </label>
              <input
                type="color"
                value={localValue || '#000000'}
                onChange={handleNativeColorChange}
                className="w-full h-8 rounded-lg cursor-pointer border border-[color:var(--border)]"
              />
            </div>

            {/* Preset colors */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1.5 block">
                Presets
              </label>
              <div className="grid grid-cols-7 gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handlePresetClick(color)}
                    className={`h-6 w-6 rounded-md border transition hover:scale-110 ${
                      localValue?.toLowerCase() === color.toLowerCase()
                        ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]/30'
                        : 'border-[color:var(--border)]'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Clear button */}
            {localValue && (
              <button
                type="button"
                onClick={() => {
                  setLocalValue('');
                  onChange('');
                }}
                className="mt-3 w-full text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
              >
                Clear color
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

