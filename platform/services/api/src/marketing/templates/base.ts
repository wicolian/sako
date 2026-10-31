/**
 * Unified Email Base Template - Light Mode (Universal Compatibility)
 * 
 * Clean, professional light theme for all SAKO emails
 * - Marketing emails (D0, D1, D3, D5, D10)
 * - Transactional emails (task updates, billing, invites)
 * 
 * NOTE: Email clients strip <style> tags, so all styling must be inline.
 * This template uses inline styles exclusively for maximum compatibility.
 */

// SAKO Brand Assets
export const SAKO_LOGO_URL = 'https://app.trysako.com/All_svgs/wordwork.png';
export const SAKO_LOGO_DARK_URL = SAKO_LOGO_URL;
export const SAKO_LOGO_LIGHT_URL = SAKO_LOGO_URL;
export const SAKO_LOGO_WHITE_URL = SAKO_LOGO_URL;
export const SAKO_ICON_URL = SAKO_LOGO_URL;
export const FOUNDER_AVATAR_URL = ''; // Removed - no longer using avatars

// Brand colors - Light theme (universally compatible)
export const BRAND_GREEN = '#9AE83E';
export const BRAND_GREEN_DARK = '#7FBF2E';
export const BRAND_GREEN_DARKER = '#5a9a1f';

// Light theme colors
export const BRAND_BG = '#ffffff';
export const BRAND_CARD = '#ffffff';
export const BRAND_SURFACE = '#fafafa';
export const BRAND_BORDER = '#e5e5e5';
export const BRAND_TEXT = '#171717';
export const BRAND_TEXT_MUTED = '#525252';
export const BRAND_TEXT_SUBTLE = '#737373';

// Legacy exports for compatibility
export const BRAND_DARK = '#0a0a0a';

// Accent colors (light theme versions)
export const BRAND_GREEN_BG = '#f0fdf4'; // Light green background
export const BRAND_GREEN_BORDER = '#86efac'; // Green border
export const BRAND_BLUE_BG = '#eff6ff';
export const BRAND_YELLOW_BG = '#fefce8';
export const BRAND_GRAY_BG = '#f5f5f5';
export const BRAND_RED_BG = '#fef2f2';

interface BaseTemplateVars {
  subject: string;
  preheader: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  companyAddress: string;
  signatureAvatarUrl?: string; // Deprecated - ignored
}

export function wrapInBaseTemplate(vars: BaseTemplateVars): string {
  const { subject, preheader, bodyHtml, unsubscribeUrl, companyAddress } = vars;

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Light mode only */
    :root { color-scheme: light; }
    body, html { background-color: ${BRAND_SURFACE} !important; }
    
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
      .mobile-padding { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: ${BRAND_SURFACE}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">

  <!-- Hidden preheader text -->
  <div style="display: none; font-size: 1px; color: ${BRAND_SURFACE}; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
    &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847;
  </div>

  <!-- Full-width wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${BRAND_SURFACE};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        
        <!-- Email container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" class="email-container" style="width: 560px; max-width: 100%; background-color: ${BRAND_CARD}; border-radius: 12px; border: 1px solid ${BRAND_BORDER}; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">

          <!-- Header with SAKO logo -->
          <tr>
            <td style="padding: 14px 28px 10px 28px; border-bottom: 1px solid ${BRAND_BORDER};">
              <img src="${SAKO_LOGO_URL}" alt="SAKO" width="32" height="auto" style="display: block; width: 32px; height: auto;">
            </td>
          </tr>

          <!-- Main content area -->
          <tr>
            <td class="mobile-padding" style="padding: 28px;">
              ${bodyHtml}
            </td>
          </tr>
          
        </table>
        
        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width: 560px; max-width: 100%;">
          <tr>
            <td style="padding: 24px 28px; text-align: center;">
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: ${BRAND_TEXT_SUBTLE}; margin: 0 0 8px 0;">
                ${companyAddress}
              </p>
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: ${BRAND_TEXT_SUBTLE}; margin: 0;">
                <a href="${unsubscribeUrl}" style="color: ${BRAND_TEXT_SUBTLE}; text-decoration: underline;">Unsubscribe</a>
                <span style="margin: 0 6px; color: ${BRAND_TEXT_SUBTLE};">·</span>
                <a href="https://trysako.com" style="color: ${BRAND_TEXT_SUBTLE}; text-decoration: underline;">trysako.com</a>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `.trim();
}

// CTA Button - SAKO branded green
export function ctaButton(text: string, url: string, variant: 'primary' | 'secondary' = 'primary'): string {
  if (variant === 'secondary') {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="border-radius: 8px; border: 1px solid ${BRAND_BORDER}; background-color: ${BRAND_CARD};">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 500; color: ${BRAND_TEXT}; text-decoration: none; border-radius: 8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
    `;
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="border-radius: 8px; background-color: ${BRAND_GREEN};">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: ${BRAND_TEXT}; text-decoration: none; border-radius: 8px;">
            ${text} →
          </a>
        </td>
      </tr>
    </table>
  `;
}

// Accent box for highlights - light green on light theme
export function accentBox(content: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0;">
      <tr>
        <td style="background-color: ${BRAND_GREEN_BG}; border: 1px solid ${BRAND_GREEN_BORDER}; border-left: 3px solid ${BRAND_GREEN}; border-radius: 8px; padding: 16px 18px;">
          ${content}
        </td>
      </tr>
    </table>
  `;
}

// Paragraph text
export function paragraph(text: string): string {
  return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.7; color: ${BRAND_TEXT}; margin: 0 0 16px 0;">${text}</p>`;
}

// Muted text (smaller, lighter)
export function mutedText(text: string): string {
  return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: ${BRAND_TEXT_MUTED}; margin: 0 0 12px 0;">${text}</p>`;
}

// Bullet list
export function bulletList(items: string[]): string {
  const listItems = items.map(item => `<li style="margin-bottom: 8px; padding-left: 4px;">${item}</li>`).join('');
  return `<ul style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.7; color: ${BRAND_TEXT}; margin: 0 0 16px 0; padding-left: 20px;">${listItems}</ul>`;
}

// Numbered list
export function numberedList(items: string[]): string {
  const listItems = items.map(item => `<li style="margin-bottom: 8px; padding-left: 4px;">${item}</li>`).join('');
  return `<ol style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.7; color: ${BRAND_TEXT}; margin: 0 0 16px 0; padding-left: 20px;">${listItems}</ol>`;
}

// Status badge - solid colors for email compatibility
export function statusBadge(text: string, color: 'green' | 'blue' | 'yellow' | 'gray' | 'red' = 'gray'): string {
  const colors = {
    green: { bg: BRAND_GREEN_BG, text: BRAND_GREEN_DARKER },
    blue: { bg: BRAND_BLUE_BG, text: '#2563eb' },
    yellow: { bg: BRAND_YELLOW_BG, text: '#ca8a04' },
    gray: { bg: BRAND_GRAY_BG, text: BRAND_TEXT_MUTED },
    red: { bg: BRAND_RED_BG, text: '#dc2626' },
  };
  const c = colors[color];
  return `<span style="display: inline-block; padding: 4px 12px; background-color: ${c.bg}; color: ${c.text}; border-radius: 9999px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 600;">${text}</span>`;
}

// Heading
export function heading(text: string): string {
  return `<h2 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 600; color: ${BRAND_TEXT}; margin: 0 0 20px 0; line-height: 1.3;">${text}</h2>`;
}

// Divider
export function divider(): string {
  return `<hr style="border: none; border-top: 1px solid ${BRAND_BORDER}; margin: 20px 0;">`;
}
