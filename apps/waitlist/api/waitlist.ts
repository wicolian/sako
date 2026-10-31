import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Send confirmation email
    const emailFrom = process.env.EMAIL_FROM || 'SAKO <noreply@updates.trysako.com>';
    
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: 'Welcome to the SAKO waitlist! 🚀',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0A0A0A;">
            <div style="background-color: #1a1a1a; border-radius: 12px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
              <h1 style="color: #9AE83E; font-size: 28px; font-weight: 600; margin: 0 0 20px 0; letter-spacing: -0.025em;">
                You're in! 🎉
              </h1>
              <p style="color: #FAFAFA; font-size: 16px; margin: 0 0 20px 0;">
                Thanks for joining the SAKO waitlist. We're excited to have you on board.
              </p>
              <p style="color: #A3A3A3; font-size: 14px; margin: 0 0 20px 0;">
                SAKO goes live on <strong style="color: #FAFAFA;">Dec 30, 2025 at 12:00 PM IST</strong>. As a waitlist member, you'll get <strong style="color: #9AE83E;">15% off</strong> your first month.
              </p>
              <div style="background-color: rgba(154, 232, 62, 0.1); border: 1px solid rgba(154, 232, 62, 0.3); border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
                <p style="color: #9AE83E; font-size: 16px; font-weight: 600; margin: 0 0 8px 0; text-align: center;">
                  🎁 Your discount code
                </p>
                <p style="color: #FAFAFA; font-size: 18px; font-weight: 600; margin: 0; text-align: center; letter-spacing: 0.5px;">
                  SAKONOWAIT15
                </p>
              </div>
              <p style="color: #A3A3A3; font-size: 14px; margin: 0;">
                We'll keep you updated on our progress. No spam, promise.
              </p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                <p style="color: #525252; font-size: 12px; margin: 0;">
                  — The SAKO Team
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    // Send notification email to hello@example.com (non-blocking)
    // If this fails, we still return success since the user got their confirmation
    try {
      await resend.emails.send({
        from: emailFrom,
        to: 'hello@example.com',
        subject: `New Waitlist Signup: ${email}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #f9fafb; border-radius: 12px; padding: 30px; border: 1px solid #e5e7eb;">
                <h2 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">
                  🎉 New Waitlist Signup
                </h2>
                <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 0 0 20px 0; border: 1px solid #e5e7eb;">
                  <p style="color: #374151; font-size: 16px; margin: 0 0 12px 0;">
                    <strong>Email:</strong> ${email}
                  </p>
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">
                    <strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'long' })}
                  </p>
                </div>
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  This person has been added to the SAKO waitlist and received their confirmation email with discount code.
                </p>
              </div>
            </body>
          </html>
        `,
      });
    } catch (notificationError) {
      // Log but don't fail - the user already got their confirmation
      console.error('Failed to send notification email:', notificationError);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

