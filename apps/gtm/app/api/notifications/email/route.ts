import { NextRequest, NextResponse } from 'next/server'
import {
  sendApprovalReminderEmail,
  sendBudgetAlertEmail,
  sendCommentMentionEmail,
} from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    switch (body.type) {
      case 'budget_alert':
        await sendBudgetAlertEmail(body.payload)
        return NextResponse.json({ success: true })
      case 'comment_notification':
        await sendCommentMentionEmail(body.payload)
        return NextResponse.json({ success: true })
      case 'approval_reminder':
        await sendApprovalReminderEmail(body.payload)
        return NextResponse.json({ success: true })
      default:
        return NextResponse.json({ error: 'Unsupported email type' }, { status: 400 })
    }
  } catch (error) {
    console.error('POST /api/notifications/email error:', error)
    return NextResponse.json({ error: 'Failed to send email notification' }, { status: 500 })
  }
}
