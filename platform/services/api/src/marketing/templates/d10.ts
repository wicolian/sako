/**
 * Day 10 Email Template
 * "Last ping, want a quick walkthrough?" - final follow-up with calendar link
 */

import { wrapInBaseTemplate, ctaButton, paragraph, bulletList } from './base';

interface D10Vars {
  firstName: string;
  pricingUrl: string;
  unsubscribeUrl: string;
  companyAddress: string;
  calendarUrl: string;
}

export function getD10Template(vars: D10Vars): { subject: string; html: string } {
  const { firstName, unsubscribeUrl, companyAddress, calendarUrl } = vars;

  const subject = 'If not, I\'ll close the loop';
  const preheader = 'Last message from me. Book a 10 minute walkthrough?';

  const bodyHtml = `
    ${paragraph(`Hey ${firstName},`)}
    
    ${paragraph(`<strong>Last message from me.</strong>`)}
    
    ${paragraph(`If you're still curious but not convinced, book a 10 minute walkthrough and I'll show:`)}
    
    ${bulletList([
      'How requests flow',
      'How capacity and SLAs work',
      'How reviews and handoffs don\'t turn into chaos',
    ])}
    
    ${ctaButton('Grab a Slot →', calendarUrl)}
    
    ${paragraph(`If you're out, click unsubscribe and I'm gone. No hard feelings.`)}
    
    ${paragraph(`– The Sako team`)}
  `;

  const html = wrapInBaseTemplate({
    subject,
    preheader,
    bodyHtml,
    unsubscribeUrl,
    companyAddress,
  });

  return { subject, html };
}
