import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export function CommentMentionEmail({
  recipientName,
  authorName,
  commentText,
  projectName,
  projectUrl,
  notificationType,
}: {
  recipientName?: string
  authorName: string
  commentText: string
  projectName: string
  projectUrl: string
  notificationType: 'mention' | 'reply'
}) {
  const preview =
    notificationType === 'mention'
      ? `${authorName} mentioned you in ${projectName}`
      : `${authorName} replied in ${projectName}`

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>
            {notificationType === 'mention' ? 'You were mentioned' : 'New reply'}
          </Heading>
          <Text style={text}>
            {recipientName ? `Hi ${recipientName},` : 'Hi,'}
          </Text>
          <Text style={text}>
            {authorName} {notificationType === 'mention' ? 'mentioned you' : 'replied to your comment'} in{' '}
            {projectName}.
          </Text>
          <Section style={panel}>
            <Text style={quote}>{commentText}</Text>
          </Section>
          <Button href={projectUrl} style={button}>
            Open project
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
const panel = { backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', margin: '20px 0' }
const quote = { color: '#0f172a', fontSize: '14px', lineHeight: '22px', margin: 0 }
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
