/**
 * Day 5 Email Template
 * "10% off for 5 days" - coupon offer
 */

import { wrapInBaseTemplate, ctaButton, accentBox, paragraph, BRAND_GREEN, BRAND_TEXT, BRAND_TEXT_MUTED } from './base';

interface D5Vars {
  firstName: string;
  pricingUrl: string;
  unsubscribeUrl: string;
  companyAddress: string;
  promoCode: string;
  promoExpiryDate: string;
  redeemUrl: string;
}

export function getD5Template(vars: D5Vars): { subject: string; html: string } {
  const { firstName, pricingUrl, unsubscribeUrl, companyAddress, promoCode, promoExpiryDate, redeemUrl } = vars;

  const subject = 'A small push to remove the "eh maybe later" loop';
  const preheader = "Here's 10% off for the next 5 days...";

  const promoBoxContent = `
    <p style="font-size: 11px; color: ${BRAND_TEXT_MUTED}; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
      Your code
    </p>
    <p style="font-size: 24px; font-weight: 700; color: ${BRAND_TEXT}; margin: 0 0 12px 0; font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace; letter-spacing: 2px;">
      ${promoCode}
    </p>
    <p style="font-size: 13px; color: ${BRAND_TEXT_MUTED}; margin: 0;">
      <strong style="color: ${BRAND_GREEN};">10%</strong> off any plan · Expires <strong style="color: ${BRAND_TEXT};">${promoExpiryDate}</strong>
    </p>
  `;

  const bodyHtml = `
    ${paragraph(`Hey ${firstName},`)}
    
    ${paragraph(`If the only thing stopping you was "price feels annoying right now", here.`)}
    
    ${accentBox(promoBoxContent)}
    
    ${ctaButton('Redeem Discount →', redeemUrl)}
    
    <p style="font-size: 13px; color: ${BRAND_TEXT_MUTED}; margin: 16px 0;">
      Or copy the code and use it at checkout: <a href="${pricingUrl}" style="color: ${BRAND_TEXT}; font-weight: 500;">${pricingUrl}</a>
    </p>
    
    ${paragraph(`If you don't want a discount and just want clarity, reply with your use-case and I'll tell you straight which plan fits. No upsell bullshit.`)}
    
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
