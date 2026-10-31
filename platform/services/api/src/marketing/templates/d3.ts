/**
 * Day 3 Email Template
 * "Just ship" - short email
 */

import { wrapInBaseTemplate, ctaButton, paragraph, numberedList } from './base';

interface D3Vars {
  firstName: string;
  pricingUrl: string;
  unsubscribeUrl: string;
  companyAddress: string;
}

export function getD3Template(vars: D3Vars): { subject: string; html: string } {
  const { firstName, pricingUrl, unsubscribeUrl, companyAddress } = vars;

  const subject = 'This is the shortest email I\'ll send you';
  const preheader = 'If design is blocking shipping, you have two options...';

  const bodyHtml = `
    ${paragraph(`${firstName},`)}
    
    ${paragraph(`If design is blocking shipping, you have two options:`)}
    
    ${numberedList([
      'Keep "figuring it out" and lose weeks',
      '<strong>Start, ship, adjust</strong>',
    ])}
    
    ${paragraph(`Sako lives here:`)}
    
    ${ctaButton('View Plans →', pricingUrl)}
    
    ${paragraph(`Reply "not now" and I'll stop. I'm not here to spam you like a desperate SaaS bro.`)}
    
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
