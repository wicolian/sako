import { createParser, type OpenUiParseResult } from './runtime'
import { sakoOpenUiLibrary } from './sako-library'

export interface OpenUiRenderResult {
  html: string
  parseResult: OpenUiParseResult
}

export function renderOpenUiToHtml(source: string): OpenUiRenderResult {
  const parser = createParser(sakoOpenUiLibrary.toJSONSchema())
  const parseResult = parser.parse(source)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sako OpenUI Source</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0f172a;
      color: #e2e8f0;
      font-family: Inter, system-ui, sans-serif;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 24px 64px;
    }
    .card {
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.85);
      box-shadow: 0 24px 80px rgba(2, 6, 23, 0.35);
      overflow: hidden;
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      background: linear-gradient(180deg, rgba(132, 204, 22, 0.14), rgba(15, 23, 42, 0));
    }
    h1 {
      margin: 0;
      font-size: 20px;
      color: #f8fafc;
    }
    p {
      margin: 8px 0 0;
      color: #94a3b8;
      line-height: 1.6;
      font-size: 14px;
    }
    .stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .stat {
      border-radius: 999px;
      padding: 6px 10px;
      background: rgba(148, 163, 184, 0.12);
      color: #cbd5e1;
      font-size: 12px;
    }
    pre {
      margin: 0;
      padding: 24px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.7;
      color: #e2e8f0;
      background: rgba(2, 6, 23, 0.55);
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <div class="header">
        <h1>OpenUI source snapshot</h1>
        <p>Server-side HTML export for OpenUI is disabled in this environment. This view preserves the parsed source and validation metadata without importing react-dom/server into the route graph.</p>
        <div class="stats">
          <span class="stat">Statements: ${parseResult.meta.statementCount}</span>
          <span class="stat">Unresolved: ${parseResult.meta.unresolved.length}</span>
          <span class="stat">Validation: ${parseResult.meta.validationErrors.length}</span>
          <span class="stat">${parseResult.meta.incomplete ? 'Streaming' : 'Complete'}</span>
        </div>
      </div>
      <pre>${escapeHtml(source)}</pre>
    </section>
  </main>
</body>
</html>`

  return { html, parseResult }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
