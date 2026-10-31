import Link from 'next/link'

const termsSections = [
  {
    title: 'Use of Service',
    body:
      'Sako Composer is a workspace for generating, reviewing, and exporting go-to-market assets. You are responsible for the content you import, the claims you approve, and the destinations you publish to.',
  },
  {
    title: 'Compliance Responsibility',
    body:
      'The product surfaces claim risk, evidence links, and approval states. Those controls support your review process, but they do not replace legal review where your business requires it.',
  },
  {
    title: 'Workspace Data',
    body:
      'Imported brand context, uploaded evidence, generated assets, provider connections, and usage telemetry are processed to operate the workspace and improve reliability, abuse prevention, and support.',
  },
  {
    title: 'Provider Integrations',
    body:
      'If you connect HubSpot, Webflow, Framer, or other destinations, you authorize Sako Composer to use those connections for actions you explicitly trigger inside the product.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16 space-y-10">
        <div className="space-y-4">
          <Link href="/signup" className="text-sm font-medium text-primary hover:underline">
            Back to sign up
          </Link>
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
            <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
            <p className="text-muted-foreground">Effective March 10, 2026.</p>
          </div>
        </div>

        {termsSections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="leading-7 text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  )
}
