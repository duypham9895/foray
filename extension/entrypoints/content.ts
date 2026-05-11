export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    storePageInfo(window.location.href)

    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isUrlChangedMessage(message)) return

      storePageInfo(message.url || window.location.href)
      window.setTimeout(() => {
        storePageInfo(message.url || window.location.href)
      }, 250)
    })
  },
})

function isUrlChangedMessage(
  message: unknown,
): message is { type: 'URL_CHANGED'; url?: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'URL_CHANGED'
  )
}

function storePageInfo(url: string) {
  void chrome.storage.local.set({
    lastPageInfo: {
      title: document.title,
      url,
      timestamp: new Date().toISOString(),
    },
  })
}
