/**
 * Sako Composer Chrome Extension - Background Service Worker
 * 
 * Handles:
 * - Context menu actions
 * - Keyboard shortcuts
 * - Authentication state
 * - API communication
 */

const API_BASE = 'https://api.sako.ai'

// ============================================================================
// Context Menu Setup
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  // Create context menus
  chrome.contextMenus.create({
    id: 'sako-generate',
    title: 'Generate with Sako',
    contexts: ['selection'],
  })
  
  chrome.contextMenus.create({
    id: 'sako-validate',
    title: 'Validate Claim with Sako',
    contexts: ['selection'],
  })
  
  chrome.contextMenus.create({
    id: 'sako-rewrite',
    title: 'Rewrite with AI',
    contexts: ['selection'],
  })
  
  chrome.contextMenus.create({
    id: 'sako-separator',
    type: 'separator',
    contexts: ['selection'],
  })
  
  chrome.contextMenus.create({
    id: 'sako-expand',
    title: 'Expand Selection',
    contexts: ['selection'],
  })
  
  chrome.contextMenus.create({
    id: 'sako-summarize',
    title: 'Summarize Selection',
    contexts: ['selection'],
  })
  
  chrome.contextMenus.create({
    id: 'sako-translate',
    title: 'Translate Selection',
    contexts: ['selection'],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return
  
  const selectedText = info.selectionText
  if (!selectedText) return
  
  switch (info.menuItemId) {
    case 'sako-generate':
      await handleGenerate(tab.id, selectedText)
      break
    case 'sako-validate':
      await handleValidate(tab.id, selectedText)
      break
    case 'sako-rewrite':
      await handleRewrite(tab.id, selectedText)
      break
    case 'sako-expand':
      await handleExpand(tab.id, selectedText)
      break
    case 'sako-summarize':
      await handleSummarize(tab.id, selectedText)
      break
    case 'sako-translate':
      await handleTranslate(tab.id, selectedText)
      break
  }
})

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  
  switch (command) {
    case 'generate-content':
      chrome.tabs.sendMessage(tab.id, { action: 'get-selection' }, async (response) => {
        if (response?.selectedText) {
          await handleGenerate(tab.id, response.selectedText)
        }
      })
      break
    case 'validate-claim':
      chrome.tabs.sendMessage(tab.id, { action: 'get-selection' }, async (response) => {
        if (response?.selectedText) {
          await handleValidate(tab.id, response.selectedText)
        }
      })
      break
  }
})

// ============================================================================
// Action Handlers
// ============================================================================

async function handleGenerate(tabId, text) {
  try {
    // Show loading state
    chrome.tabs.sendMessage(tabId, {
      action: 'show-loading',
      message: 'Generating content...',
    })
    
    const auth = await getAuthToken()
    if (!auth) {
      chrome.tabs.sendMessage(tabId, {
        action: 'show-error',
        message: 'Please sign in to Sako first',
      })
      return
    }
    
    const brandId = await getSelectedBrandId()
    
    const response = await fetch(`${API_BASE}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        prompt: text,
        type: 'rewrite',
        brandId: brandId || undefined,
      }),
    })
    
    if (!response.ok) throw new Error('Generation failed')
    
    const result = await response.json()
    
    chrome.tabs.sendMessage(tabId, {
      action: 'show-result',
      type: 'generate',
      original: text,
      result: result.content,
    })
  } catch (error) {
    console.error('Generate error:', error)
    chrome.tabs.sendMessage(tabId, {
      action: 'show-error',
      message: 'Failed to generate content',
    })
  }
}

async function handleValidate(tabId, text) {
  try {
    chrome.tabs.sendMessage(tabId, {
      action: 'show-loading',
      message: 'Validating claim...',
    })
    
    const auth = await getAuthToken()
    if (!auth) {
      chrome.tabs.sendMessage(tabId, {
        action: 'show-error',
        message: 'Please sign in to Sako first',
      })
      return
    }
    
    const response = await fetch(`${API_BASE}/v1/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ claim: text }),
    })
    
    if (!response.ok) throw new Error('Validation failed')
    
    const result = await response.json()
    
    chrome.tabs.sendMessage(tabId, {
      action: 'show-result',
      type: 'validate',
      original: text,
      result: result,
    })
  } catch (error) {
    console.error('Validate error:', error)
    chrome.tabs.sendMessage(tabId, {
      action: 'show-error',
      message: 'Failed to validate claim',
    })
  }
}

async function handleRewrite(tabId, text) {
  try {
    chrome.tabs.sendMessage(tabId, {
      action: 'show-loading',
      message: 'Rewriting...',
    })
    
    const auth = await getAuthToken()
    if (!auth) {
      chrome.tabs.sendMessage(tabId, {
        action: 'show-error',
        message: 'Please sign in to Sako first',
      })
      return
    }
    
    const brandId = await getSelectedBrandId()
    
    const response = await fetch(`${API_BASE}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        prompt: text,
        type: 'rewrite',
        instruction: 'Rewrite this to be more compelling and clear while keeping the same meaning',
        brandId: brandId || undefined,
      }),
    })
    
    if (!response.ok) throw new Error('Rewrite failed')
    
    const result = await response.json()
    
    chrome.tabs.sendMessage(tabId, {
      action: 'show-result',
      type: 'rewrite',
      original: text,
      result: result.content,
    })
  } catch (error) {
    console.error('Rewrite error:', error)
    chrome.tabs.sendMessage(tabId, {
      action: 'show-error',
      message: 'Failed to rewrite content',
    })
  }
}

async function handleExpand(tabId, text) {
  try {
    chrome.tabs.sendMessage(tabId, {
      action: 'show-loading',
      message: 'Expanding...',
    })
    
    const auth = await getAuthToken()
    if (!auth) {
      chrome.tabs.sendMessage(tabId, {
        action: 'show-error',
        message: 'Please sign in to Sako first',
      })
      return
    }
    
    const response = await fetch(`${API_BASE}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        prompt: text,
        type: 'expand',
        instruction: 'Expand this with more detail and supporting points',
      }),
    })
    
    if (!response.ok) throw new Error('Expand failed')
    
    const result = await response.json()
    
    chrome.tabs.sendMessage(tabId, {
      action: 'show-result',
      type: 'expand',
      original: text,
      result: result.content,
    })
  } catch (error) {
    console.error('Expand error:', error)
    chrome.tabs.sendMessage(tabId, {
      action: 'show-error',
      message: 'Failed to expand content',
    })
  }
}

async function handleSummarize(tabId, text) {
  try {
    chrome.tabs.sendMessage(tabId, {
      action: 'show-loading',
      message: 'Summarizing...',
    })
    
    const auth = await getAuthToken()
    if (!auth) {
      chrome.tabs.sendMessage(tabId, {
        action: 'show-error',
        message: 'Please sign in to Sako first',
      })
      return
    }
    
    const response = await fetch(`${API_BASE}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        prompt: text,
        type: 'summarize',
        instruction: 'Summarize this concisely',
      }),
    })
    
    if (!response.ok) throw new Error('Summarize failed')
    
    const result = await response.json()
    
    chrome.tabs.sendMessage(tabId, {
      action: 'show-result',
      type: 'summarize',
      original: text,
      result: result.content,
    })
  } catch (error) {
    console.error('Summarize error:', error)
    chrome.tabs.sendMessage(tabId, {
      action: 'show-error',
      message: 'Failed to summarize content',
    })
  }
}

async function handleTranslate(tabId, text) {
  try {
    chrome.tabs.sendMessage(tabId, {
      action: 'show-translate-options',
      text,
    })
  } catch (error) {
    console.error('Translate error:', error)
  }
}

// ============================================================================
// Auth & Brand Helpers
// ============================================================================

let selectedBrandId = null

async function getAuthToken() {
  const result = await chrome.storage.local.get(['sakoAuth'])
  return result.sakoAuth || null
}

async function getSelectedBrandId() {
  const result = await chrome.storage.local.get(['selectedBrandId'])
  return result.selectedBrandId || null
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'set-auth') {
    chrome.storage.local.set({ sakoAuth: request.auth })
    sendResponse({ success: true })
  } else if (request.action === 'get-auth') {
    getAuthToken().then(auth => sendResponse({ auth }))
    return true // Keep channel open for async response
  } else if (request.action === 'clear-auth') {
    chrome.storage.local.remove(['sakoAuth', 'selectedBrandId'])
    sendResponse({ success: true })
  } else if (request.action === 'set-brand') {
    selectedBrandId = request.brandId
    chrome.storage.local.set({ selectedBrandId: request.brandId })
    sendResponse({ success: true })
  } else if (request.action === 'get-brand') {
    getSelectedBrandId().then(brandId => sendResponse({ brandId }))
    return true
  }
})
