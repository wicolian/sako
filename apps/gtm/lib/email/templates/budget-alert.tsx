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

export function BudgetAlertEmail({
  workspaceName,
  threshold,
  currentSpend,
  hardCap,
}: {
  workspaceName: string
  threshold: number
  currentSpend: number
  hardCap: number
}) {
  const dollars = (value: number) => `$${(value / 100).toFixed(2)}`

  return (
    <Html>
      <Head />
      <Preview>{`${workspaceName} has crossed its ${threshold}% budget threshold.`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Budget alert</Heading>
          <Text style={text}>
            {workspaceName} has crossed its {`${threshold}%`} monthly budget threshold.
          </Text>
          <Section style={panel}>
            <Text style={metric}>Current spend: {dollars(currentSpend)}</Text>
            <Text style={metric}>Monthly cap: {dollars(hardCap)}</Text>
          </Section>
          <Button href="https://app.sako.ai/settings" style={button}>
            Review budget settings
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: '#f6f9fc', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '32px', maxWidth: '560px' }
const heading = { fontSize: '24px', marginBottom: '12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px' }
const panel = { backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', margin: '20px 0' }
const metric = { margin: '0 0 8px', color: '#0f172a' }
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
