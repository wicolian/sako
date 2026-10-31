# Brevo Automation Setup (Welcome & Confirmation Emails)

Contacts are added to lists via our API. **You must configure Brevo automations** so that emails are sent when contacts are added. The API alone does not send any emails.

---

## Why You Didn't Receive Emails

The list updated (contact was added) but no email was sent because **Brevo automations are not configured yet**. Our API only adds contacts to lists; Brevo workflows send the emails.

---

## 1. Newsletter Welcome Automation

1. In Brevo: **Automation** → **Create workflow**
2. **Trigger:** Contact added to list → Select **Sako Newsletter** (ID: 11)
3. **Action:** Send email
   - Create or select a welcome email template
   - Subject: e.g. "You're in – here's what to expect"
   - From: Koushik from Sako \<hello@example.com\>
   - Reply-to: hello@example.com
   - Include `{{ unsubscribe }}` in the footer (required for compliance)
4. **Delay:** 1 minute (optional, or immediate)
5. Activate the workflow

---

## 2. Demo Request Auto-Reply

1. In Brevo: **Automation** → **Create workflow**
2. **Trigger:** Contact added to list → Select **Sako Demo Requests** (ID: 12)
3. **Action:** Send email
   - Create a confirmation template
   - Subject: e.g. "We got your demo request – we'll be in touch within 24h"
   - From: Koushik from Sako \<hello@example.com\>
   - Reply-to: hello@example.com
   - Body: "Thanks for your interest. We'll review your request and get back within 24 hours."
   - Include `{{ unsubscribe }}` in the footer
4. **Delay:** 1 minute (or immediate)
5. Activate the workflow

---

## 3. Unsubscribe & Preference Center

**In emails:** Use the `{{ unsubscribe }}` placeholder. Recipients go to Brevo's unsubscribe page (customize in Brevo → Settings → Campaigns → Unsubscribe pages).

**On the site:** We provide [https://trysako.com/newsletter/preferences](https://trysako.com/newsletter/preferences) where users can enter their email to unsubscribe. This calls our API which removes them from the newsletter list and marks them as unsubscribed in Brevo.

---

## 4. Custom Attributes (Optional)

If you want to see Stage, Primary need, Plan interest, and UTM attribution in Brevo contact records, create these attributes in Brevo:

- **Contacts** → **Settings** → **Attributes** → Create:
  - `COMPANY_SIZE` (text)
  - `PRIMARY_NEED` (text)
  - `PLAN_INTEREST` (text)
  - `UTM_SOURCE` (text)
  - `UTM_MEDIUM` (text)
  - `UTM_CAMPAIGN` (text)
  - `UTM_CONTENT` (text)
  - `UTM_TERM` (text)

Our newsletter and demo forms send these values. UTM params are persisted across the session, so attribution is preserved even if the user navigates before submitting. If the attributes don't exist, Brevo may ignore them (no error).

---

## 5. Sender Configuration

Ensure your sender is verified in Brevo:

- **From:** Koushik from Sako \<hello@example.com\>
- **Reply-to:** hello@example.com
- DKIM, DMARC, and domain verification should already be set per your setup

---

## Summary

| List               | ID | Automation to create                          |
|--------------------|----|-----------------------------------------------|
| Sako Newsletter    | 11 | Welcome email when contact added             |
| Sako Demo Requests | 12 | Auto-reply confirmation when contact added   |

After these automations are active, new signups will receive the appropriate emails.
