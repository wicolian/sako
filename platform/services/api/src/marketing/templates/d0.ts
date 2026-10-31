/**
 * Day 0 Email Template
 * "You were looking at Sako" - sent immediately after signup
 */

import { wrapInBaseTemplate, ctaButton, paragraph } from './base';

interface D0Vars {
  firstName: string;
  pricingUrl: string;
  unsubscribeUrl: string;
  companyAddress: string;
}

export function getD0Template(vars: D0Vars): { subject: string; html: string } {
  const { firstName, pricingUrl, unsubscribeUrl, companyAddress } = vars;

  const subject = 'Quick nudge, then I\'ll get out of your way';
  const preheader = 'You made it far enough to sign up for Sako...';

  const bodyHtml = `
    ${paragraph(`Hey ${firstName},`)}
    
    ${paragraph(`You made it far enough to sign up for Sako, then bailed at checkout.`)}
    
    ${paragraph(`No judgement. Happens.`)}
    
    ${paragraph(`If you still want design delivery without the hiring circus, pick a plan here:`)}
    
    ${ctaButton('View Plans →', pricingUrl)}
    
    ${paragraph(`If something felt off (price, trust, timing), reply with one line and I'll fix the real problem, not guess.`)}
    
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
