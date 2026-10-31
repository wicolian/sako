/**
 * Export design templates from Supabase to SQL file for Neon import
 */

import { createServiceClient } from '../lib/supabase/service';

async function exportTemplates() {
  console.log('🚀 Exporting design templates from Supabase...');

  const supabase = createServiceClient();

  // Get all templates with embeddings
  const { data: templates, error } = await supabase
    .from('design_templates')
    .select('*')
    .not('embedding', 'is', null);

  if (error) {
    console.error('❌ Error fetching templates:', error);
    process.exit(1);
  }

  if (!templates || templates.length === 0) {
    console.log('❌ No templates found');
    process.exit(1);
  }

  console.log(`📊 Found ${templates.length} templates with embeddings`);

  // Create simple INSERT statements for core fields only
  const fs = require('fs');
  const sqlStatements: string[] = [];

  for (const template of templates) {
    // Convert embedding array to PostgreSQL vector format
    let embeddingStr = 'NULL';
    if (template.embedding) {
      if (Array.isArray(template.embedding)) {
        embeddingStr = `[${template.embedding.join(',')}]`;
      } else if (typeof template.embedding === 'string') {
        embeddingStr = `'${template.embedding}'`;
      }
    }

    // Simple INSERT with only the essential fields
    const insertStatement = `INSERT INTO design_templates (id, section_id, template_name, category, html, description, embedding, source_file, quality_score, times_used, created_at, updated_at) VALUES ('${template.id}', '${template.section_id}', '${(template.template_name || '').replace(/'/g, "''")}', '${template.category || ''}', '${(template.html || '').replace(/'/g, "''")}', '${(template.description || '').replace(/'/g, "''")}', ${embeddingStr}, ${template.source_file ? `'${template.source_file.replace(/'/g, "''")}'` : 'NULL'}, ${template.quality_score || 0.5}, ${template.times_used || 0}, '${template.created_at}', '${template.updated_at}');`;

    sqlStatements.push(insertStatement);
  }

  const sqlContent = sqlStatements.join('\n');
  fs.writeFileSync('design_templates_backup.sql', sqlContent);

  console.log(`✅ Exported ${templates.length} templates to design_templates_backup.sql`);
  console.log(`📄 File size: ${sqlContent.length} characters`);
}

// Run the export
exportTemplates().catch(console.error);