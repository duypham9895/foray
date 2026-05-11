type OptionsStorage = {
  apiToken?: string
  forayUrl?: string
}

const DEFAULT_FORAY_URL = 'http://localhost:3000'

const form = getForm('settings-form')
const forayUrlInput = getInput('foray-url')
const apiTokenInput = getInput('api-token')
const statusText = getElement('status')

document.addEventListener('DOMContentLoaded', () => {
  void populateOptions()
})

form.addEventListener('submit', (event) => {
  event.preventDefault()
  void saveOptions()
})

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element: ${id}`)
  return element
}

function getInput(id: string): HTMLInputElement {
  const element = getElement(id)
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Expected input: ${id}`)
  }
  return element
}

function getForm(id: string): HTMLFormElement {
  const element = getElement(id)
  if (!(element instanceof HTMLFormElement)) {
    throw new Error(`Expected form: ${id}`)
  }
  return element
}

async function populateOptions() {
  const stored = await chrome.storage.local.get(['apiToken', 'forayUrl']) as OptionsStorage
  forayUrlInput.value = stored.forayUrl || DEFAULT_FORAY_URL
  apiTokenInput.value = stored.apiToken || ''
}

async function saveOptions() {
  const forayUrl = normalizeForayUrl(forayUrlInput.value)
  const apiToken = apiTokenInput.value.trim()

  if (!apiToken) {
    setStatus('API token is required.')
    return
  }

  await chrome.storage.local.set({ apiToken, forayUrl } satisfies OptionsStorage)
  setStatus('Saved.')
}

function normalizeForayUrl(value: string): string {
  const trimmed = value.trim() || DEFAULT_FORAY_URL
  return trimmed.replace(/\/+$/, '')
}

function setStatus(message: string) {
  statusText.textContent = message
}
