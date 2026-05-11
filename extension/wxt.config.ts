import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    name: 'Foray',
    description: 'Capture job postings to Foray.',
    permissions: ['activeTab', 'storage', 'webNavigation'],
    host_permissions: ['<all_urls>'],
    options_ui: {
      page: 'options.html',
      open_in_tab: false,
    },
    action: {
      default_title: 'Foray',
    },
  },
})
