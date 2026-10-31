/**
 * Google Apps Script to create all missing sheet tabs for n8n-sako
 * 
 * HOW TO USE:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1kuvMIZS5a7GYnHDlByL4LfkQf1kHbVxSmL8LogIjMgQ/
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click "Run" (play button) to execute createAllSheets()
 * 5. Grant permissions when prompted
 * 6. Check your spreadsheet - all tabs should be created!
 * 7. Copy the gids from the console log output
 */

function createAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Define all sheets with their headers
  const sheets = {
    // These already exist (verified gids)
    // qualified_leads: 492604584
    // content_backlog: 1620036434
    // call_tracker: 31482936
    // pr_backlog: 888766463
    // warm_opens: 1096236767
    // hiring_signals: 339358735
    
    // CREATE THESE:
    'apollo_import': [
      'First Name', 'Last Name', 'Title', 'Company Name', 'Email', '# Employees',
      'Industry', 'Keywords', 'Person Linkedin Url', 'Website', 'Company Linkedin Url',
      'City', 'Country'
    ],
    
    'disqualified_leads': [
      'first_name', 'last_name', 'email', 'title', 'company', 'industry',
      'icp_score', 'reasoning', 'red_flags', 'scored_at'
    ],
    
    'suppression_list': [
      'email', 'reason', 'suppressed_at', 'source'
    ],
    
    'idempotency_log': [
      'external_event_id', 'processed_at', 'workflow'
    ],
    
    'inmail_outreach': [
      'email', 'linkedin_url', 'first_name', 'last_name', 'title', 'company',
      'subject', 'body', 'personalization_hook', 'recommended_package', 'status',
      'generated_at', 'approved_by', 'approved_at', 'sent_by', 'sent_at',
      'response_status', 'response_date', 'meeting_booked', 'notes'
    ],
    
    'media_targets': [
      'outlet_name', 'contact', 'format', 'audience_fit', 'linkedin_url', 'last_pitched_at'
    ],
    
    'coverage': [
      'url', 'outlet', 'type', 'date', 'badge_allowed'
    ],
    
    'campaign_links': [
      'id', 'destination_url', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'created_at', 'clicks'
    ],
    
    'content_monitor_targets': [
      'url', 'label', 'enabled', 'contentSelector', 'screenshotSelector',
      'last_changed_at', 'last_change_summary'
    ],
    
    'candidate_pipeline': [
      'linkedin_url', 'name', 'title', 'current_company', 'email', 'phone',
      'skills', 'experience_years', 'portfolio_url', 'score', 'strengths',
      'gaps', 'status', 'sourced_at', 'outreach_sent', 'response',
      'interview_scheduled', 'notes'
    ],
    
    'workflow_metrics': [
      'workflow_name', 'execution_date', 'success_count', 'error_count',
      'avg_duration_ms', 'last_error', 'last_success_at'
    ],
    
    'sales_objections': [
      'objection', 'frequency', 'response_template', 'success_rate',
      'tags', 'last_updated'
    ],
    
    'case_studies': [
      'client_name', 'industry', 'challenge', 'solution', 'results',
      'testimonial_quote', 'contact_name', 'logo_url', 'published_url', 'status'
    ],
    
    'industry_news': [
      'source', 'title', 'url', 'published_at', 'summary', 'tags'
    ],
    
    'journalist_profiles': [
      'outlet_name', 'contact_email', 'linkedin_url', 'profile_name',
      'profile_headline', 'profile_company', 'profile_recent', 'last_enriched_at'
    ]
  };
  
  const createdSheets = [];
  const skippedSheets = [];
  
  for (const [sheetName, headers] of Object.entries(sheets)) {
    // Check if sheet already exists
    let sheet = ss.getSheetByName(sheetName);
    
    if (sheet) {
      skippedSheets.push(sheetName);
      continue;
    }
    
    // Create new sheet
    sheet = ss.insertSheet(sheetName);
    
    // Add headers
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    createdSheets.push({
      name: sheetName,
      gid: sheet.getSheetId()
    });
  }
  
  // Log results
  console.log('=== SHEET CREATION COMPLETE ===\n');
  
  if (createdSheets.length > 0) {
    console.log('✅ CREATED SHEETS (copy these gids to fix-workflow-sheets.mjs):');
    for (const s of createdSheets) {
      console.log(`  ${s.name}: ${s.gid},`);
    }
  }
  
  if (skippedSheets.length > 0) {
    console.log('\n⏭️ SKIPPED (already exist):');
    console.log('  ' + skippedSheets.join(', '));
  }
  
  // Show alert
  SpreadsheetApp.getUi().alert(
    'Sheet Creation Complete',
    `Created: ${createdSheets.length} sheets\nSkipped: ${skippedSheets.length} (already exist)\n\nCheck the Apps Script logs for gid values.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
