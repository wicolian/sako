-- ============================================================================
-- Multi-Language Support (Phase 1.4)
-- Support for 95+ languages in content generation
-- ============================================================================

-- Add language columns to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_language TEXT DEFAULT 'en';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_languages TEXT[] DEFAULT ARRAY['en'];

-- Create languages reference table
CREATE TABLE IF NOT EXISTS supported_languages (
  code TEXT PRIMARY KEY, -- ISO 639-1 code
  name TEXT NOT NULL,
  native_name TEXT,
  direction TEXT DEFAULT 'ltr', -- 'ltr' or 'rtl'
  is_active BOOLEAN DEFAULT TRUE,
  tier TEXT DEFAULT 'standard' -- 'premium', 'standard', 'beta'
);

-- Insert supported languages (95+)
INSERT INTO supported_languages (code, name, native_name, direction, tier) VALUES
  -- Tier 1: Premium (Best support)
  ('en', 'English', 'English', 'ltr', 'premium'),
  ('es', 'Spanish', 'Español', 'ltr', 'premium'),
  ('fr', 'French', 'Français', 'ltr', 'premium'),
  ('de', 'German', 'Deutsch', 'ltr', 'premium'),
  ('pt', 'Portuguese', 'Português', 'ltr', 'premium'),
  ('it', 'Italian', 'Italiano', 'ltr', 'premium'),
  ('nl', 'Dutch', 'Nederlands', 'ltr', 'premium'),
  ('ja', 'Japanese', '日本語', 'ltr', 'premium'),
  ('ko', 'Korean', '한국어', 'ltr', 'premium'),
  ('zh', 'Chinese (Simplified)', '简体中文', 'ltr', 'premium'),
  ('zh-TW', 'Chinese (Traditional)', '繁體中文', 'ltr', 'premium'),
  
  -- Tier 2: Standard
  ('ar', 'Arabic', 'العربية', 'rtl', 'standard'),
  ('he', 'Hebrew', 'עברית', 'rtl', 'standard'),
  ('hi', 'Hindi', 'हिन्दी', 'ltr', 'standard'),
  ('ru', 'Russian', 'Русский', 'ltr', 'standard'),
  ('pl', 'Polish', 'Polski', 'ltr', 'standard'),
  ('tr', 'Turkish', 'Türkçe', 'ltr', 'standard'),
  ('sv', 'Swedish', 'Svenska', 'ltr', 'standard'),
  ('no', 'Norwegian', 'Norsk', 'ltr', 'standard'),
  ('da', 'Danish', 'Dansk', 'ltr', 'standard'),
  ('fi', 'Finnish', 'Suomi', 'ltr', 'standard'),
  ('cs', 'Czech', 'Čeština', 'ltr', 'standard'),
  ('el', 'Greek', 'Ελληνικά', 'ltr', 'standard'),
  ('hu', 'Hungarian', 'Magyar', 'ltr', 'standard'),
  ('ro', 'Romanian', 'Română', 'ltr', 'standard'),
  ('th', 'Thai', 'ไทย', 'ltr', 'standard'),
  ('vi', 'Vietnamese', 'Tiếng Việt', 'ltr', 'standard'),
  ('id', 'Indonesian', 'Bahasa Indonesia', 'ltr', 'standard'),
  ('ms', 'Malay', 'Bahasa Melayu', 'ltr', 'standard'),
  ('tl', 'Filipino', 'Filipino', 'ltr', 'standard'),
  ('uk', 'Ukrainian', 'Українська', 'ltr', 'standard'),
  ('bg', 'Bulgarian', 'Български', 'ltr', 'standard'),
  ('hr', 'Croatian', 'Hrvatski', 'ltr', 'standard'),
  ('sk', 'Slovak', 'Slovenčina', 'ltr', 'standard'),
  ('sl', 'Slovenian', 'Slovenščina', 'ltr', 'standard'),
  ('sr', 'Serbian', 'Српски', 'ltr', 'standard'),
  ('lt', 'Lithuanian', 'Lietuvių', 'ltr', 'standard'),
  ('lv', 'Latvian', 'Latviešu', 'ltr', 'standard'),
  ('et', 'Estonian', 'Eesti', 'ltr', 'standard'),
  ('ca', 'Catalan', 'Català', 'ltr', 'standard'),
  ('eu', 'Basque', 'Euskara', 'ltr', 'standard'),
  ('gl', 'Galician', 'Galego', 'ltr', 'standard'),
  
  -- Tier 3: Beta (Good but may need review)
  ('af', 'Afrikaans', 'Afrikaans', 'ltr', 'beta'),
  ('sw', 'Swahili', 'Kiswahili', 'ltr', 'beta'),
  ('am', 'Amharic', 'አማርኛ', 'ltr', 'beta'),
  ('bn', 'Bengali', 'বাংলা', 'ltr', 'beta'),
  ('gu', 'Gujarati', 'ગુજરાતી', 'ltr', 'beta'),
  ('kn', 'Kannada', 'ಕನ್ನಡ', 'ltr', 'beta'),
  ('ml', 'Malayalam', 'മലയാളം', 'ltr', 'beta'),
  ('mr', 'Marathi', 'मराठी', 'ltr', 'beta'),
  ('pa', 'Punjabi', 'ਪੰਜਾਬੀ', 'ltr', 'beta'),
  ('ta', 'Tamil', 'தமிழ்', 'ltr', 'beta'),
  ('te', 'Telugu', 'తెలుగు', 'ltr', 'beta'),
  ('ur', 'Urdu', 'اردو', 'rtl', 'beta'),
  ('fa', 'Persian', 'فارسی', 'rtl', 'beta'),
  ('ne', 'Nepali', 'नेपाली', 'ltr', 'beta'),
  ('si', 'Sinhala', 'සිංහල', 'ltr', 'beta'),
  ('my', 'Burmese', 'မြန်မာ', 'ltr', 'beta'),
  ('km', 'Khmer', 'ខ្មែរ', 'ltr', 'beta'),
  ('lo', 'Lao', 'ລາວ', 'ltr', 'beta'),
  ('mn', 'Mongolian', 'Монгол', 'ltr', 'beta'),
  ('ka', 'Georgian', 'ქართული', 'ltr', 'beta'),
  ('hy', 'Armenian', 'Հայերdelays', 'ltr', 'beta'),
  ('az', 'Azerbaijani', 'Azərbaycan', 'ltr', 'beta'),
  ('kk', 'Kazakh', 'Қазақ', 'ltr', 'beta'),
  ('uz', 'Uzbek', 'O''zbek', 'ltr', 'beta'),
  ('is', 'Icelandic', 'Íslenska', 'ltr', 'beta'),
  ('mt', 'Maltese', 'Malti', 'ltr', 'beta'),
  ('cy', 'Welsh', 'Cymraeg', 'ltr', 'beta'),
  ('ga', 'Irish', 'Gaeilge', 'ltr', 'beta'),
  ('gd', 'Scottish Gaelic', 'Gàidhlig', 'ltr', 'beta'),
  ('sq', 'Albanian', 'Shqip', 'ltr', 'beta'),
  ('mk', 'Macedonian', 'Македонски', 'ltr', 'beta'),
  ('bs', 'Bosnian', 'Bosanski', 'ltr', 'beta'),
  ('lb', 'Luxembourgish', 'Lëtzebuergesch', 'ltr', 'beta'),
  ('be', 'Belarusian', 'Беларуская', 'ltr', 'beta'),
  ('zu', 'Zulu', 'IsiZulu', 'ltr', 'beta'),
  ('xh', 'Xhosa', 'IsiXhosa', 'ltr', 'beta'),
  ('yo', 'Yoruba', 'Yorùbá', 'ltr', 'beta'),
  ('ig', 'Igbo', 'Igbo', 'ltr', 'beta'),
  ('ha', 'Hausa', 'Hausa', 'ltr', 'beta'),
  ('so', 'Somali', 'Soomaali', 'ltr', 'beta'),
  ('rw', 'Kinyarwanda', 'Ikinyarwanda', 'ltr', 'beta'),
  ('sn', 'Shona', 'ChiShona', 'ltr', 'beta'),
  ('mg', 'Malagasy', 'Malagasy', 'ltr', 'beta'),
  ('eo', 'Esperanto', 'Esperanto', 'ltr', 'beta'),
  ('la', 'Latin', 'Latina', 'ltr', 'beta'),
  ('jv', 'Javanese', 'Basa Jawa', 'ltr', 'beta'),
  ('su', 'Sundanese', 'Basa Sunda', 'ltr', 'beta'),
  ('haw', 'Hawaiian', 'ʻŌlelo Hawaiʻi', 'ltr', 'beta'),
  ('mi', 'Maori', 'Te Reo Māori', 'ltr', 'beta'),
  ('sm', 'Samoan', 'Gagana Samoa', 'ltr', 'beta')
ON CONFLICT (code) DO NOTHING;

-- Index for active languages
CREATE INDEX idx_supported_languages_active ON supported_languages(is_active, tier);

-- Track language usage statistics
CREATE TABLE IF NOT EXISTS language_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES supported_languages(code),
  content_type TEXT, -- 'campaign', 'email', 'social', etc.
  generation_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, language_code, content_type)
);

CREATE INDEX idx_language_usage_workspace ON language_usage_stats(workspace_id);
