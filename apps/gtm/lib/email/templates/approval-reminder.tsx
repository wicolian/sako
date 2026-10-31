import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export function ApprovalReminderEmail({
  campaignName,
  stageName,
  approverNames,
  approvalUrl,
}: {
  campaignName: string
  stageName: string
  approverNames: string[]
  approvalUrl: string
}) {
  return (
    <Html>
      <Head />
      <Preview>{campaignName} is waiting on approval.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Approval needed</Heading>
          <Text style={text}>
            {campaignName} has advanced to <strong>{stageName}</strong>.
          </Text>
          <Text style={text}>
            Notified approvers: {approverNames.length > 0 ? approverNames.join(', ') : 'Workspace reviewers'}
          </Text>
          <Button href={approvalUrl} style={button}>
            Review campaign
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: '#f6f9fc', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '32px', maxWidth: '560px' }
const heading = { fontSize: '24px', marginBottom: '12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '0 0 12px' }
const button = {
  backgroundColor: '#9ae83e',
  borderRadius: '8px',
  color: '#0f172a',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 18px',
  textDecoration: 'none',
}
