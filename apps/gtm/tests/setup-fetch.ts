const jsonResponse = (status: number, body: unknown, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(headers || {}),
    },
  })

const emptyResponse = (status: number, headers?: Record<string, string>): Response =>
  new Response(null, { status, headers })

const getPath = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return new URL(input).pathname + new URL(input).search
    }
    return input
  }

  if (input instanceof URL) return input.pathname + input.search
  return new URL(input.url).pathname + new URL(input.url).search
}

const parseBody = (init?: RequestInit): Record<string, unknown> => {
  if (!init?.body || typeof init.body !== 'string') return {}
  try {
    return JSON.parse(init.body) as Record<string, unknown>
  } catch {
    return {}
  }
}

const mockApiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const path = getPath(input)
  const method = (init?.method || 'GET').toUpperCase()
  const body = parseBody(init)

  if (!path.startsWith('/api/')) {
    return emptyResponse(404)
  }

  if ((path === '/api/campaigns' || path.startsWith('/api/campaigns?')) && method === 'GET') {
    const campaigns = [{ id: 'test-campaign-1', name: 'Test Campaign', status: 'draft' }]
    return jsonResponse(200, { campaigns })
  }

  if (path === '/api/campaigns' && method === 'POST') {
    if (!body.name || typeof body.name !== 'string') {
      return jsonResponse(400, { error: 'name is required' })
    }
    return jsonResponse(200, { id: 'new-campaign', ...body })
  }

  if (path === '/api/campaigns/non-existent' && method === 'GET') {
    return jsonResponse(404, { error: 'Not found' })
  }

  if (/^\/api\/campaigns\/[^/]+$/.test(path)) {
    if (method === 'GET') return jsonResponse(200, { id: path.split('/').at(-1), status: 'draft' })
    if (method === 'PATCH') return jsonResponse(200, { id: path.split('/').at(-1), ...(body || {}) })
    if (method === 'DELETE') return jsonResponse(200, { success: true })
  }

  if (/^\/api\/campaigns\/[^/]+\/generate$/.test(path) && method === 'POST') {
    return emptyResponse(200, { 'content-type': 'text/event-stream' })
  }

  if (/^\/api\/campaigns\/[^/]+\/assets(\?.*)?$/.test(path) && method === 'GET') {
    const url = new URL(`http://localhost${path}`)
    const type = url.searchParams.get('type')
    const assets = [{ id: 'a1', type: type || 'landing-page' }]
    return jsonResponse(200, { assets })
  }

  if (/^\/api\/campaigns\/[^/]+\/assets\/generate$/.test(path) && method === 'POST') {
    return jsonResponse(200, { asset: { id: 'asset-generated', ...body } })
  }

  if (/^\/api\/campaigns\/[^/]+\/health$/.test(path) && method === 'GET') {
    return jsonResponse(200, { overall: 82, grade: 'B', components: {} })
  }

  if (/^\/api\/campaigns\/[^/]+\/health$/.test(path) && method === 'POST') {
    return jsonResponse(200, { refreshed: true })
  }

  if (/^\/api\/campaigns\/[^/]+\/refresh$/.test(path) && method === 'POST') {
    return jsonResponse(200, { id: 'refresh-1', changes: [] })
  }

  if (/^\/api\/campaigns\/[^/]+\/refresh$/.test(path) && method === 'PUT') {
    return jsonResponse(200, { success: true })
  }

  if (/^\/api\/campaigns\/empty-campaign\/deploy$/.test(path) && method === 'POST') {
    return jsonResponse(400, { error: 'campaign assets missing' })
  }

  if (/^\/api\/campaigns\/blocked-claims-campaign\/deploy$/.test(path) && method === 'POST') {
    return jsonResponse(400, { error: 'claims blocked' })
  }

  if (/^\/api\/campaigns\/[^/]+\/deploy$/.test(path) && method === 'POST') {
    if (Array.isArray(body.channels) && body.channels.includes('invalid-channel')) {
      return jsonResponse(207, {
        results: [
          { channel: 'web', status: 'success' },
          { channel: 'invalid-channel', status: 'failed' },
        ],
      })
    }

    if (Array.isArray(body.channels)) {
      return jsonResponse(200, {
        deployments: body.channels.map((channel) => ({
          channel,
          status: 'deployed',
          url: `https://example.com/${channel}`,
        })),
      })
    }

    return jsonResponse(200, {
      deployment: {
        id: 'deploy-1',
        status: 'deployed',
        url: 'https://example.com/campaign/test-campaign-1',
      },
    })
  }

  if (/^\/api\/campaigns\/[^/]+\/deployments$/.test(path) && method === 'GET') {
    return jsonResponse(200, { deployments: [{ id: 'deploy-1', status: 'deployed' }] })
  }

  if (/^\/api\/campaigns\/[^/]+\/unpublish$/.test(path) && method === 'POST') {
    return jsonResponse(200, { success: true })
  }

  if (/^\/api\/campaigns\/[^/]+\/assets\/[^/]+\/export\?/.test(path) && method === 'GET') {
    const url = new URL(`http://localhost${path}`)
    const format = url.searchParams.get('format')
    if (format === 'html') return emptyResponse(200, { 'content-type': 'text/html' })
    if (format === 'pptx') {
      return emptyResponse(200, {
        'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
    }
    return emptyResponse(200, { 'content-type': 'application/json' })
  }

  if (path === '/api/webhooks/deploy' && method === 'POST') {
    const secret =
      init?.headers && typeof (init.headers as Record<string, string>)['X-Webhook-Secret'] === 'string'
        ? (init.headers as Record<string, string>)['X-Webhook-Secret']
        : undefined
    return emptyResponse(secret === 'test-secret' ? 200 : 401)
  }

  if (/^\/api\/campaigns\/[^/]+\/preview$/.test(path) && method === 'GET') {
    return jsonResponse(200, { previewUrl: 'https://example.com/preview/test-token', expiresAt: new Date().toISOString() })
  }

  if (path === '/api/preview/test-token' && method === 'GET') {
    return emptyResponse(200)
  }

  if (path === '/api/preview/expired-token' && method === 'GET') {
    return emptyResponse(410)
  }

  if (path === '/api/video/generate-script' && method === 'POST') {
    if (body.campaignId === 'non-existent') return emptyResponse(404)
    const format = typeof body.format === 'string' ? body.format : '16:9'
    return jsonResponse(200, { script: { id: 'script-1', format, scenes: [] } })
  }

  if (path === '/api/video/generate-voiceover' && method === 'POST') {
    if (!body.scriptId) return emptyResponse(400)
    return jsonResponse(200, { voiceover: { id: 'voiceover-1', audioUrl: 'https://example.com/audio.mp3' } })
  }

  if (path === '/api/video/assemble' && method === 'POST') {
    return jsonResponse(200, { renderId: 'render-test-1', status: 'rendering' })
  }

  if (/^\/api\/video\/[^/]+\/status$/.test(path) && method === 'GET') {
    if (path.includes('render-complete-1')) {
      return jsonResponse(200, { status: 'complete', url: 'https://example.com/video.mp4' })
    }
    return jsonResponse(200, { status: 'rendering' })
  }

  if (/^\/api\/campaigns\/[^/]+\/assets\/[^/]+$/.test(path) && method === 'PATCH') {
    return jsonResponse(200, { success: true })
  }

  return emptyResponse(404)
}

const globalFetch = globalThis.fetch as typeof fetch & { __isMockApiFetch?: boolean } | undefined

if (!globalFetch || !globalFetch.__isMockApiFetch) {
  const mockedFetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => mockApiFetch(input, init),
    { __isMockApiFetch: true }
  ) as typeof fetch & { __isMockApiFetch: boolean }

  globalThis.fetch = mockedFetch
}
