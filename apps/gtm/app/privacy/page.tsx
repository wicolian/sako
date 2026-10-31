import Link from 'next/link'

const privacySections = [
  {
    title: 'What we collect',
    body:
      'Account details, workspace metadata, brand imports, evidence records, generated assets, deployment metadata, and product telemetry required to operate Composer and support users.',
  },
  {
    title: 'How data is used',
    body:
      'Data is used to authenticate users, persist workspace state, validate claims, power generation and deployment flows, meter usage, and investigate abuse or failures.',
  },
  {
    title: 'Provider data',
    body:
      'Connected provider credentials are stored for the purpose of actions you authorize. Tokens are used only for the linked workspace and can be revoked by disconnecting the provider.',
  },
  {
    title: 'Retention',
    body:
      'Workspace content remains available until removed by the workspace or deleted under account closure procedures, subject to backups, audit logs, and legal retention requirements.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16 space-y-10">
        <div className="space-y-4">
          <Link href="/signup" className="text-sm font-medium text-primary hover:underline">
            Back to sign up
          </Link>
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
            <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-muted-foreground">Effective March 10, 2026.</p>
          </div>
        </div>

        {privacySections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="leading-7 text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  )
}
