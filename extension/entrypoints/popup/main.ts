type StorageState = {
  apiToken?: string
  forayUrl?: string
  lastPageInfo?: PageInfo
  lastCapture?: {
    title: string
    url: string
    timestamp: string
  }
}

type CaptureResponse = {
  redirectUrl?: string
  error?: string
}

type PageInfo = {
  title: string
  url: string
  timestamp: string
}

const DEFAULT_FORAY_URL = 'http://localhost:3000'

const tabTitle = getElement('tab-title')
const tabUrl = getElement('tab-url')
const captureButton = getButton('capture-btn')
const optionsButton = getButton('options-btn')
const statusBox = getElement('status')
const openForayLink = getAnchor('open-foray')
const setupHint = getElement('setup-hint')

document.addEventListener('DOMContentLoaded', () => {
  void renderPopup()
})

optionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

captureButton.addEventListener('click', () => {
  void captureCurrentTab()
})

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element: ${id}`)
  return element
}

function getButton(id: string): HTMLButtonElement {
  const element = getElement(id)
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Expected button: ${id}`)
  }
  return element
}

function getAnchor(id: string): HTMLAnchorElement {
  const element = getElement(id)
  if (!(element instanceof HTMLAnchorElement)) {
    throw new Error(`Expected anchor: ${id}`)
  }
  return element
}

async function renderPopup() {
  const state = await readStorage()
  const token = state.apiToken?.trim()

  if (!token) {
    tabTitle.textContent = 'API token needed'
    tabUrl.textContent = DEFAULT_FORAY_URL
    captureButton.disabled = true
    setupHint.classList.remove('hidden')
    return
  }

  const pageInfo = await getCurrentPageInfo(state)
  if (!pageInfo?.url) {
    tabTitle.textContent = 'No active tab'
    tabUrl.textContent = '-'
    captureButton.disabled = true
    showStatus('Open a job posting tab before capturing.', 'neutral')
    return
  }

  tabTitle.textContent = pageInfo.title.trim() || 'Untitled page'
  tabUrl.textContent = pageInfo.url
  captureButton.disabled = false
  setupHint.classList.add('hidden')
}

async function captureCurrentTab() {
  const state = await readStorage()
  const token = state.apiToken?.trim()
  if (!token) {
    showStatus('Add your API token in extension settings.', 'error')
    captureButton.disabled = true
    setupHint.classList.remove('hidden')
    return
  }

  const pageInfo = await getCurrentPageInfo(state)
  if (!pageInfo?.url) {
    showStatus('No active tab to capture.', 'error')
    return
  }

  const title = pageInfo.title.trim() || 'Untitled page'
  const forayUrl = normalizeForayUrl(state.forayUrl)

  captureButton.disabled = true
  captureButton.textContent = 'Capturing...'
  openForayLink.classList.add('hidden')
  showStatus('Capturing page...', 'neutral')

  try {
    const response = await fetch(`${forayUrl}/api/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, url: pageInfo.url }),
    })

    const body = (await response.json().catch(() => ({}))) as CaptureResponse

    if (!response.ok) {
      const message = response.status === 401
        ? 'Invalid token. Check extension settings.'
        : body.error || `Capture failed with ${response.status}.`
      showStatus(message, 'error')
      return
    }

    if (!body.redirectUrl) {
      showStatus('Capture returned no Foray link.', 'error')
      return
    }

    await chrome.storage.local.set({
      lastCapture: {
        title,
        url: pageInfo.url,
        timestamp: new Date().toISOString(),
      },
    } satisfies Partial<StorageState>)

    openForayLink.href = `${forayUrl}${body.redirectUrl}`
    openForayLink.classList.remove('hidden')
    showStatus(`Captured ${title}.`, 'success')
  } catch {
    showStatus('Foray is not reachable. Check the local URL.', 'error')
  } finally {
    captureButton.disabled = false
    captureButton.textContent = 'Capture'
  }
}

async function readStorage(): Promise<StorageState> {
  return chrome.storage.local.get([
    'apiToken',
    'forayUrl',
    'lastPageInfo',
    'lastCapture',
  ])
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function getCurrentPageInfo(
  state: StorageState,
): Promise<PageInfo | null> {
  const tab = await getActiveTab()
  const tabInfo = tab?.url
    ? {
        title: tab.title?.trim() || 'Untitled page',
        url: tab.url,
        timestamp: new Date().toISOString(),
      }
    : null

  if (tabInfo && state.lastPageInfo?.url === tabInfo.url) {
    return {
      ...tabInfo,
      title: state.lastPageInfo.title.trim() || tabInfo.title,
      timestamp: state.lastPageInfo.timestamp,
    }
  }

  return tabInfo ?? state.lastPageInfo ?? null
}

function normalizeForayUrl(value: string | undefined): string {
  const trimmed = value?.trim() || DEFAULT_FORAY_URL
  return trimmed.replace(/\/+$/, '')
}

function showStatus(
  message: string,
  tone: 'success' | 'error' | 'neutral',
) {
  statusBox.textContent = message
  statusBox.className = `status status-${tone}`
}
