-- Components Library Migration
-- Reusable UI components for the website builder

-- Components table
CREATE TABLE IF NOT EXISTS ui_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL for global/system components
  
  -- Component info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- hero, section, button, card, header, footer, etc.
  tags TEXT[] DEFAULT '{}',
  
  -- Visual
  thumbnail_url TEXT,
  preview_html TEXT, -- Small preview snippet
  
  -- Content
  html TEXT NOT NULL,
  css TEXT,
  js TEXT,
  
  -- Style configuration
  styles JSONB DEFAULT '{}',
  variants JSONB DEFAULT '[]', -- Different style variants
  
  -- Access control
  is_pro BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false, -- Visible in marketplace
  is_system BOOLEAN DEFAULT false, -- Built-in component
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  
  -- Meta
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Component categories enum/reference
CREATE TABLE IF NOT EXISTS component_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Emoji or icon name
  sort_order INTEGER DEFAULT 0
);

-- Insert default categories
INSERT INTO component_categories (id, name, description, icon, sort_order) VALUES
  ('hero', 'Hero', 'Main headline sections with CTAs', '🚀', 1),
  ('section', 'Section', 'General content sections', '📄', 2),
  ('header', 'Header', 'Navigation headers', '🔝', 3),
  ('footer', 'Footer', 'Page footers', '🔚', 4),
  ('feature', 'Feature', 'Feature highlight cards', '✨', 5),
  ('testimonial', 'Testimonial', 'Customer quotes and reviews', '💬', 6),
  ('pricing', 'Pricing', 'Pricing tables and cards', '💰', 7),
  ('cta', 'CTA', 'Call-to-action blocks', '🎯', 8),
  ('faq', 'FAQ', 'Frequently asked questions', '❓', 9),
  ('form', 'Form', 'Contact and signup forms', '📝', 10),
  ('card', 'Card', 'Content cards', '🃏', 11),
  ('button', 'Button', 'Button styles', '🔘', 12),
  ('heading', 'Heading', 'Typography headings', '📰', 13),
  ('logo', 'Logo', 'Logo clouds and grids', '🏢', 14),
  ('stats', 'Stats', 'Statistics and numbers', '📊', 15),
  ('gallery', 'Gallery', 'Image galleries', '🖼️', 16),
  ('background', 'Background', 'Background patterns', '🎨', 17)
ON CONFLICT (id) DO NOTHING;

-- User saved components (bookmarks)
CREATE TABLE IF NOT EXISTS user_saved_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES ui_components(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, component_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_components_workspace ON ui_components(workspace_id);
CREATE INDEX IF NOT EXISTS idx_components_category ON ui_components(category);
CREATE INDEX IF NOT EXISTS idx_components_public ON ui_components(is_public);
CREATE INDEX IF NOT EXISTS idx_components_system ON ui_components(is_system);
CREATE INDEX IF NOT EXISTS idx_components_tags ON ui_components USING GIN(tags);

-- RLS Policies
ALTER TABLE ui_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_components ENABLE ROW LEVEL SECURITY;

-- Components: view public, system, or workspace-owned
CREATE POLICY "Users can view components"
  ON ui_components FOR SELECT
  USING (
    is_public = true OR
    is_system = true OR
    workspace_id IS NULL OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ui_components.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Components: create in workspace
CREATE POLICY "Users can create workspace components"
  ON ui_components FOR INSERT
  WITH CHECK (
    workspace_id IS NULL OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ui_components.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Components: update own workspace components
CREATE POLICY "Users can update workspace components"
  ON ui_components FOR UPDATE
  USING (
    workspace_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ui_components.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Components: delete own workspace components
CREATE POLICY "Users can delete workspace components"
  ON ui_components FOR DELETE
  USING (
    workspace_id IS NOT NULL AND
    NOT is_system AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ui_components.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Saved components: own only
CREATE POLICY "Users can manage own saved components"
  ON user_saved_components FOR ALL
  USING (user_id = auth.uid());

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_component_usage(component_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ui_components
  SET usage_count = usage_count + 1
  WHERE id = component_id;
END;
$$ LANGUAGE plpgsql;

-- Insert some default system components
INSERT INTO ui_components (name, description, category, html, is_system, is_public) VALUES
(
  'Simple Hero',
  'A clean hero section with headline, subheadline, and CTA',
  'hero',
  '<section class="py-20 px-6">
  <div class="max-w-4xl mx-auto text-center">
    <h1 class="text-5xl font-bold mb-6">Your Headline Here</h1>
    <p class="text-xl text-gray-600 mb-8">Your subheadline goes here. Make it compelling and clear.</p>
    <a href="#" class="inline-block px-8 py-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Get Started</a>
  </div>
</section>',
  true,
  true
),
(
  'Feature Grid',
  '3-column feature grid with icons',
  'feature',
  '<section class="py-16 px-6 bg-gray-50">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-3xl font-bold text-center mb-12">Features</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="p-6 bg-white rounded-xl shadow-sm">
        <div class="text-4xl mb-4">⚡</div>
        <h3 class="text-xl font-semibold mb-2">Fast</h3>
        <p class="text-gray-600">Lightning fast performance out of the box.</p>
      </div>
      <div class="p-6 bg-white rounded-xl shadow-sm">
        <div class="text-4xl mb-4">🔒</div>
        <h3 class="text-xl font-semibold mb-2">Secure</h3>
        <p class="text-gray-600">Enterprise-grade security built in.</p>
      </div>
      <div class="p-6 bg-white rounded-xl shadow-sm">
        <div class="text-4xl mb-4">🎨</div>
        <h3 class="text-xl font-semibold mb-2">Beautiful</h3>
        <p class="text-gray-600">Stunning designs that convert.</p>
      </div>
    </div>
  </div>
</section>',
  true,
  true
),
(
  'Testimonial Cards',
  'Customer testimonial cards in a grid',
  'testimonial',
  '<section class="py-16 px-6">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-3xl font-bold text-center mb-12">What Our Customers Say</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="p-6 bg-white rounded-xl border shadow-sm">
        <p class="text-gray-600 mb-4 italic">"This product changed our workflow completely. Highly recommended!"</p>
        <p class="font-semibold">Jane Doe</p>
        <p class="text-sm text-gray-500">CEO, Company</p>
      </div>
      <div class="p-6 bg-white rounded-xl border shadow-sm">
        <p class="text-gray-600 mb-4 italic">"The best tool we have ever used. Amazing support team too."</p>
        <p class="font-semibold">John Smith</p>
        <p class="text-sm text-gray-500">CTO, Startup</p>
      </div>
      <div class="p-6 bg-white rounded-xl border shadow-sm">
        <p class="text-gray-600 mb-4 italic">"Simple, elegant, and powerful. Everything we needed."</p>
        <p class="font-semibold">Sarah Johnson</p>
        <p class="text-sm text-gray-500">Founder, Agency</p>
      </div>
    </div>
  </div>
</section>',
  true,
  true
),
(
  'CTA Banner',
  'Full-width call-to-action banner',
  'cta',
  '<section class="py-16 px-6 bg-indigo-600">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
    <p class="text-xl text-indigo-100 mb-8">Join thousands of happy customers today.</p>
    <a href="#" class="inline-block px-8 py-4 bg-white text-indigo-600 font-medium rounded-lg hover:bg-gray-100">Start Free Trial</a>
  </div>
</section>',
  true,
  true
),
(
  'Pricing Table',
  '3-tier pricing table',
  'pricing',
  '<section class="py-16 px-6 bg-gray-50">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="p-8 bg-white rounded-xl shadow-sm border">
        <h3 class="text-xl font-bold mb-2">Starter</h3>
        <p class="text-4xl font-bold mb-4">$9<span class="text-lg text-gray-500">/mo</span></p>
        <ul class="space-y-2 mb-8 text-gray-600">
          <li>✓ 5 projects</li>
          <li>✓ Basic support</li>
          <li>✓ 1GB storage</li>
        </ul>
        <a href="#" class="block text-center py-3 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50">Get Started</a>
      </div>
      <div class="p-8 bg-indigo-600 rounded-xl shadow-lg text-white scale-105">
        <h3 class="text-xl font-bold mb-2">Pro</h3>
        <p class="text-4xl font-bold mb-4">$29<span class="text-lg text-indigo-200">/mo</span></p>
        <ul class="space-y-2 mb-8 text-indigo-100">
          <li>✓ Unlimited projects</li>
          <li>✓ Priority support</li>
          <li>✓ 10GB storage</li>
        </ul>
        <a href="#" class="block text-center py-3 bg-white text-indigo-600 rounded-lg hover:bg-gray-100">Get Started</a>
      </div>
      <div class="p-8 bg-white rounded-xl shadow-sm border">
        <h3 class="text-xl font-bold mb-2">Enterprise</h3>
        <p class="text-4xl font-bold mb-4">$99<span class="text-lg text-gray-500">/mo</span></p>
        <ul class="space-y-2 mb-8 text-gray-600">
          <li>✓ Everything in Pro</li>
          <li>✓ Custom integrations</li>
          <li>✓ Unlimited storage</li>
        </ul>
        <a href="#" class="block text-center py-3 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50">Contact Sales</a>
      </div>
    </div>
  </div>
</section>',
  true,
  true
)
ON CONFLICT DO NOTHING;
