/**
 * Sako Composer Chrome Extension - Content Script
 * 
 * Injected into all pages to:
 * - Handle text selection
 * - Show AI toolbar
 * - Display results in floating panels
 */

// ============================================================================
// State
// ============================================================================

let toolbarElement = null
let resultPanelElement = null
let loadingElement = null

// ============================================================================
// Toolbar Setup
// ============================================================================

function createToolbar() {
  if (toolbarElement) return toolbarElement
  
  toolbarElement = document.createElement('div')
  toolbarElement.id = 'sako-toolbar'
  toolbarElement.innerHTML = `
    <div class="sako-toolbar-container">
      <button class="sako-btn" data-action="rewrite" title="Rewrite">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="sako-btn" data-action="expand" title="Expand">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 3 21 3 21 9"/>
          <polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/>
          <line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>
      <button class="sako-btn" data-action="summarize" title="Summarize">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="21" y1="10" x2="3" y2="10"/>
          <line x1="21" y1="6" x2="3" y2="6"/>
          <line x1="21" y1="14" x2="3" y2="14"/>
          <line x1="21" y1="18" x2="3" y2="18"/>
        </svg>
      </button>
      <button class="sako-btn" data-action="validate" title="Validate Claim">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </button>
      <div class="sako-divider"></div>
      <button class="sako-btn sako-btn-primary" data-action="generate" title="Generate with AI">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </button>
    </div>
  `
  
  document.body.appendChild(toolbarElement)
  
  // Add event listeners
  toolbarElement.querySelectorAll('.sako-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const action = btn.dataset.action
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      
      if (text) {
        chrome.runtime.sendMessage({
          action: `handle-${action}`,
          text,
        })
      }
    })
  })
  
  return toolbarElement
}

function showToolbar(x, y) {
  const toolbar = createToolbar()
  toolbar.style.left = `${x}px`
  toolbar.style.top = `${y}px`
  toolbar.classList.add('visible')
}

function hideToolbar() {
  if (toolbarElement) {
    toolbarElement.classList.remove('visible')
  }
}

// ============================================================================
// Result Panel
// ============================================================================

function createResultPanel() {
  if (resultPanelElement) return resultPanelElement
  
  resultPanelElement = document.createElement('div')
  resultPanelElement.id = 'sako-result-panel'
  resultPanelElement.innerHTML = `
    <div class="sako-panel-header">
      <span class="sako-panel-title">Sako Result</span>
      <button class="sako-close-btn">&times;</button>
    </div>
    <div class="sako-panel-content"></div>
    <div class="sako-panel-actions">
      <button class="sako-action-btn" data-action="copy">Copy</button>
      <button class="sako-action-btn" data-action="replace">Replace</button>
    </div>
  `
  
  document.body.appendChild(resultPanelElement)
  
  // Close button
  resultPanelElement.querySelector('.sako-close-btn').addEventListener('click', () => {
    hideResultPanel()
  })
  
  // Copy action
  resultPanelElement.querySelector('[data-action="copy"]').addEventListener('click', () => {
    const content = resultPanelElement.querySelector('.sako-result-text')?.textContent
    if (content) {
      navigator.clipboard.writeText(content)
      showNotification('Copied to clipboard!')
    }
  })
  
  return resultPanelElement
}

function showResultPanel(type, original, result) {
  const panel = createResultPanel()
  const content = panel.querySelector('.sako-panel-content')
  
  if (type === 'validate') {
    const statusColor = result.status === 'green' ? '#22c55e' : result.status === 'yellow' ? '#eab308' : '#ef4444'
    content.innerHTML = `
      <div class="sako-validation-result">
        <div class="sako-status" style="background: ${statusColor}20; border-color: ${statusColor}">
          <span class="sako-status-icon" style="color: ${statusColor}">${result.status === 'green' ? '✓' : result.status === 'yellow' ? '!' : '✗'}</span>
          <span>${result.status.toUpperCase()}</span>
          <span class="sako-confidence">${Math.round(result.confidence * 100)}% confidence</span>
        </div>
        ${result.issues?.length ? `
          <div class="sako-issues">
            <strong>Issues:</strong>
            <ul>${result.issues.map(i => `<li>${i}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${result.suggestion ? `
          <div class="sako-suggestion">
            <strong>Suggested rewrite:</strong>
            <p class="sako-result-text">"${result.suggestion}"</p>
          </div>
        ` : ''}
      </div>
    `
  } else {
    content.innerHTML = `
      <div class="sako-text-result">
        <div class="sako-original">
          <strong>Original:</strong>
          <p>"${original}"</p>
        </div>
        <div class="sako-result">
          <strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong>
          <p class="sako-result-text">"${result}"</p>
        </div>
      </div>
    `
  }
  
  panel.classList.add('visible')
}

function hideResultPanel() {
  if (resultPanelElement) {
    resultPanelElement.classList.remove('visible')
  }
}

// ============================================================================
// Loading Indicator
// ============================================================================

function showLoading(message) {
  if (!loadingElement) {
    loadingElement = document.createElement('div')
    loadingElement.id = 'sako-loading'
    loadingElement.innerHTML = `
      <div class="sako-loading-spinner"></div>
      <span class="sako-loading-message"></span>
    `
    document.body.appendChild(loadingElement)
  }
  
  loadingElement.querySelector('.sako-loading-message').textContent = message
  loadingElement.classList.add('visible')
}

function hideLoading() {
  if (loadingElement) {
    loadingElement.classList.remove('visible')
  }
}

// ============================================================================
// Notifications
// ============================================================================

function showNotification(message) {
  const notification = document.createElement('div')
  notification.className = 'sako-notification'
  notification.textContent = message
  document.body.appendChild(notification)
  
  setTimeout(() => notification.classList.add('visible'), 10)
  
  setTimeout(() => {
    notification.classList.remove('visible')
    setTimeout(() => notification.remove(), 300)
  }, 2000)
}

function showError(message) {
  const notification = document.createElement('div')
  notification.className = 'sako-notification sako-error'
  notification.textContent = message
  document.body.appendChild(notification)
  
  setTimeout(() => notification.classList.add('visible'), 10)
  
  setTimeout(() => {
    notification.classList.remove('visible')
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// ============================================================================
// Selection Handling
// ============================================================================

let selectionTimeout = null

document.addEventListener('mouseup', (e) => {
  // Don't show toolbar if clicking on toolbar
  if (e.target.closest('#sako-toolbar') || e.target.closest('#sako-result-panel')) {
    return
  }
  
  clearTimeout(selectionTimeout)
  
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    
    if (text && text.length > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      
      showToolbar(
        rect.left + window.scrollX,
        rect.bottom + window.scrollY + 8
      )
    } else {
      hideToolbar()
    }
  }, 200)
})

// Hide toolbar when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#sako-toolbar') && !e.target.closest('#sako-result-panel')) {
    hideToolbar()
  }
})

// ============================================================================
// Message Handlers
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'get-selection':
      const selection = window.getSelection()
      sendResponse({ selectedText: selection?.toString().trim() || '' })
      break
      
    case 'show-loading':
      hideToolbar()
      showLoading(request.message)
      break
      
    case 'show-result':
      hideLoading()
      showResultPanel(request.type, request.original, request.result)
      break
      
    case 'show-error':
      hideLoading()
      showError(request.message)
      break
      
    case 'show-translate-options':
      // TODO: Implement language picker
      showNotification('Translation coming soon!')
      break
  }
})
