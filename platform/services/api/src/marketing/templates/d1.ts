/**
 * Day 1 Email Template
 * "Here's what teams ship in week 1" - social proof
 */

import { wrapInBaseTemplate, ctaButton, paragraph, bulletList } from './base';

interface D1Vars {
  firstName: string;
  pricingUrl: string;
  unsubscribeUrl: string;
  companyAddress: string;
}

export function getD1Template(vars: D1Vars): { subject: string; html: string } {
  const { firstName, pricingUrl, unsubscribeUrl, companyAddress } = vars;

  const subject = 'Concrete outcomes, not vibes';
  const preheader = "Here's what most teams ship in week 1 after they start Sako...";

  const bodyHtml = `
    ${paragraph(`Hey ${firstName},`)}
    
    ${paragraph(`Here's what most teams ship in <strong>week 1</strong> after they start Sako:`)}
    
    ${bulletList([
      'Landing page / product page refresh',
      'Ad creatives or a carousel for paid + organic',
      'A clean deck or one pager that doesn\'t look like 2017',
      'Motion cutdowns for a launch',
    ])}
    
    ${paragraph(`The point is <strong>speed plus sanity</strong>. One queue, clear capacity, real delivery.`)}
    
    ${paragraph(`If you want in, it's here:`)}
    
    ${ctaButton('View Plans →', pricingUrl)}
    
    ${paragraph(`If you want me to recommend the right plan, hit reply with: <em>"team size, what you need monthly, and where design bottlenecks you"</em>.`)}
    
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
