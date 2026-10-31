import type { ReactElement } from 'react'
import { Resend } from 'resend'
import { BudgetAlertEmail } from './templates/budget-alert'
import { CommentMentionEmail } from './templates/comment-mention'
import { ApprovalReminderEmail } from './templates/approval-reminder'

const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Sako <noreply@sako.ai>'

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }

  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string | string[]
  subject: string
  react: ReactElement
}) {
  const resend = getResendClient()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email:', subject)
    return { skipped: true }
  }

  return resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    react,
  })
}

export async function sendBudgetAlertEmail(params: {
  to: string[]
  workspaceName: string
  threshold: number
  currentSpend: number
  hardCap: number
}) {
  return sendEmail({
    to: params.to,
    subject: `[Sako] Budget alert for ${params.workspaceName}`,
    react: BudgetAlertEmail(params),
  })
}

export async function sendCommentMentionEmail(params: {
  to: string
  recipientName?: string
  authorName: string
  commentText: string
  projectName: string
  projectUrl: string
  notificationType: 'mention' | 'reply'
}) {
  return sendEmail({
    to: params.to,
    subject:
      params.notificationType === 'mention'
        ? `[Sako] ${params.authorName} mentioned you`
        : `[Sako] ${params.authorName} replied to your comment`,
    react: CommentMentionEmail(params),
  })
}

export async function sendApprovalReminderEmail(params: {
  to: string[]
  campaignName: string
  stageName: string
  approverNames: string[]
  approvalUrl: string
}) {
  return sendEmail({
    to: params.to,
    subject: `[Sako] Approval needed for ${params.campaignName}`,
    react: ApprovalReminderEmail(params),
  })
}
