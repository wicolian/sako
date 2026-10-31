/**
 * Brevo configuration (API only - no form embeds).
 * All form submissions go through /api/newsletter and /api/demo.
 */

export const brevoConfig = {
  apiKey: process.env.BREVO_API_KEY,
  newsletterListId: process.env.BREVO_NEWSLETTER_LIST_ID
    ? parseInt(process.env.BREVO_NEWSLETTER_LIST_ID, 10)
    : undefined,
  demoListId: process.env.BREVO_DEMO_LIST_ID
    ? parseInt(process.env.BREVO_DEMO_LIST_ID, 10)
    : undefined,
  /** Sender for transactional emails (from Brevo dashboard) */
  sender: {
    name: 'Koushik from Sako',
    email: 'hello@example.com',
  },
  /** Reply-to for all emails */
  replyTo: 'hello@example.com',
  privacyUrl: 'https://trysako.com/legal/privacy',
} as const;

export function isBrevoConfigured(): boolean {
  return !!(
    brevoConfig.apiKey &&
    brevoConfig.newsletterListId &&
    brevoConfig.demoListId
  );
}
