/**
 * Sako Composer Chrome Extension - Popup Script
 */

const API_BASE = 'https://api.sako.ai'

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth state
  chrome.runtime.sendMessage({ action: 'get-auth' }, (response) => {
    if (response?.auth?.token) {
      showLoggedInState(response.auth)
      loadBrands(response.auth.token)
    } else {
      showLoggedOutState()
    }
  })
  
  // Sign in button
  document.getElementById('sign-in-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://app.sako.ai/login?extension=true' })
  })
  
  // Sign out button
  document.getElementById('sign-out-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clear-auth' }, () => {
      showLoggedOutState()
    })
  })
  
  // Open dashboard button
  document.getElementById('open-dashboard')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://app.sako.ai/dashboard' })
  })
  
  // Open studio button
  document.getElementById('open-studio')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://app.sako.ai/studio' })
  })
  
  // Brand selector change
  document.getElementById('brand-select')?.addEventListener('change', (e) => {
    const brandId = e.target.value
    chrome.storage.local.set({ selectedBrandId: brandId })
    chrome.runtime.sendMessage({ action: 'set-brand', brandId })
  })
  
  // Knowledge base search
  document.getElementById('search-kb-btn')?.addEventListener('click', searchKnowledge)
  document.getElementById('knowledge-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchKnowledge()
  })
})

async function loadBrands(token) {
  const brandSelect = document.getElementById('brand-select')
  if (!brandSelect) return
  
  try {
    const response = await fetch(`${API_BASE}/api/brands`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!response.ok) throw new Error('Failed to load brands')
    
    const brands = await response.json()
    
    // Get previously selected brand
    const { selectedBrandId } = await chrome.storage.local.get(['selectedBrandId'])
    
    brandSelect.innerHTML = '<option value="">No brand selected</option>'
    brands.forEach(brand => {
      const option = document.createElement('option')
      option.value = brand.id
      option.textContent = brand.name
      if (brand.id === selectedBrandId) option.selected = true
      brandSelect.appendChild(option)
    })
    
    // Set brand in background
    if (selectedBrandId) {
      chrome.runtime.sendMessage({ action: 'set-brand', brandId: selectedBrandId })
    }
  } catch (error) {
    console.error('Failed to load brands:', error)
    brandSelect.innerHTML = '<option value="">Failed to load brands</option>'
  }
}

async function searchKnowledge() {
  const searchInput = document.getElementById('knowledge-search')
  const resultsContainer = document.getElementById('knowledge-results')
  const query = searchInput?.value.trim()
  
  if (!query || !resultsContainer) return
  
  resultsContainer.innerHTML = '<div class="knowledge-empty">Searching...</div>'
  
  try {
    const { sakoAuth } = await chrome.storage.local.get(['sakoAuth'])
    if (!sakoAuth?.token) {
      resultsContainer.innerHTML = '<div class="knowledge-empty">Please sign in first</div>'
      return
    }
    
    const response = await fetch(`${API_BASE}/api/knowledge/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${sakoAuth.token}` }
    })
    
    if (!response.ok) throw new Error('Search failed')
    
    const items = await response.json()
    
    if (items.length === 0) {
      resultsContainer.innerHTML = '<div class="knowledge-empty">No results found</div>'
      return
    }
    
    resultsContainer.innerHTML = items.slice(0, 5).map(item => `
      <div class="knowledge-item" data-id="${item.id}" data-content="${escapeHtml(item.content)}">
        <div class="knowledge-item-title">${escapeHtml(item.title)}</div>
        <div class="knowledge-item-snippet">${escapeHtml(item.content.slice(0, 100))}...</div>
      </div>
    `).join('')
    
    // Add click handlers to copy content
    resultsContainer.querySelectorAll('.knowledge-item').forEach(item => {
      item.addEventListener('click', () => {
        const content = item.dataset.content
        navigator.clipboard.writeText(content)
        item.style.background = '#dcfce7'
        setTimeout(() => item.style.background = '', 1000)
      })
    })
  } catch (error) {
    console.error('Knowledge search failed:', error)
    resultsContainer.innerHTML = '<div class="knowledge-empty">Search failed</div>'
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function showLoggedInState(auth) {
  document.body.classList.remove('logged-out')
  document.body.classList.add('logged-in')
  
  const avatar = document.getElementById('user-avatar')
  const name = document.getElementById('user-name')
  const email = document.getElementById('user-email')
  
  if (auth.user) {
    const initials = (auth.user.name || auth.user.email || '?')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    
    if (avatar) avatar.textContent = initials
    if (name) name.textContent = auth.user.name || 'Sako User'
    if (email) email.textContent = auth.user.email || ''
  }
}

function showLoggedOutState() {
  document.body.classList.add('logged-out')
  document.body.classList.remove('logged-in')
}

// Listen for auth updates from the main app
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'auth-updated') {
    if (request.auth) {
      showLoggedInState(request.auth)
      loadBrands(request.auth.token)
    } else {
      showLoggedOutState()
    }
  }
})
