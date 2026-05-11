export default defineBackground(() => {
  chrome.webNavigation.onHistoryStateUpdated.addListener(
    (details) => {
      if (details.frameId !== 0) return

      chrome.tabs.sendMessage(
        details.tabId,
        { type: 'URL_CHANGED', url: details.url },
        () => {
          void chrome.runtime.lastError
        },
      )
    },
    { url: [{ schemes: ['http', 'https'] }] },
  )
})
