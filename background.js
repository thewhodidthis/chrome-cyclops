const backup = 'http://localhost:8011'
const remote = 'https://zzzxzzz.xyz'

const config = {
  origin: `${('update_url' in chrome.runtime.getManifest()) ? remote : backup}/io`,

  // Notification defaults
  notice: {
    type: 'basic',
    title: 'Cyclops',
    iconUrl: 'assets/icon.png'
  },

  contextMenus: [
    {
      id: '@cyclops-sample',
      type: 'normal',
      title: 'Feed the beast',
      contexts: ['image']
    },
    {
      id: '@cyclops-toggle-timer',
      type: 'checkbox',
      title: 'Run in background',
      contexts: ['browser_action'],
      checked: false
    }
  ]
}

const supply = {
  // Auto refresh how often
  period: 1,

  // Timer off
  repeat: false,

  // Wants notifications
  notify: false,

  // Skip timer when visiting these pages
  ignore: [
    'localhost',
    'zzzxzzz.xyz',
    '011.thewhodidthis.com',
    'mail.yahoo.com',
    'mail.google.com',
    'docs.google.com'
  ]
}

// Array contains?
const isAllowed = (a, v) => !!v && !a.some(x => v.indexOf(x) !== -1)

// Clean up image urls, remove protocol, remove trailing slash from end of string
const formatUrl = x => x.replace(/.*?:\/\//g, '').replace(/\/$/, '')

// Message formatting helpers
const spellDate = () => new Date().toTimeString().split(' ')[0]
const spellNote = x => `${spellDate()} - ${formatUrl(x)}`

// Response handling helpers
const getBuffer = from => from.arrayBuffer()
const getStatus = (response) => {
  const { status, statusText } = response

  // Success
  if (status >= 200 && status < 300) {
    return Promise.resolve(response)
  }

  const e = new Error(`${status} / ${statusText}`)

  return Promise.reject(e)
}

const signal = (notice) => {
  // Check notification preferences
  chrome.storage.sync.get('notify', ({ notify } = {}) => {
    // If notifications desired
    if (notify) {
      const from = Object.assign({}, config.notice, notice)

      chrome.notifications.create(from)
    }
  })
}

// File new image requests
const upload = ({ source, target } = {}) => fetch(target)
  .then(getStatus)
  .then(getBuffer)
  .then(body => fetch(config.origin, { body, method: 'PUT' })
    .then(getStatus)
    .then(() => {
      // Image type notifications accept blob urls
      const blob = new Blob([body])
      const data = window.URL.createObjectURL(blob)

      signal({
        contextMessage: target,
        imageUrl: data,
        message: spellNote(source),
        type: 'image'
      })
    })
  ).catch(({ message, name }) => {
    // Notify of errors as well
    signal({
      contextMessage: name === 'Error' ? target : config.origin,
      message: spellNote(message)
    })
  })

// Set icon and timers
const update = ({ url = '' } = {}) => {
  chrome.storage.sync.get('ignore', ({ ignore } = {}) => {
    const enabled = isAllowed([...ignore, 'chrome://'], url)
    const path = enabled ? 'assets/icon.png' : 'assets/icon-lo.png'

    chrome.browserAction.setIcon({ path })
    chrome.contextMenus.update('@cyclops-toggle-timer', { enabled })
  })
}

chrome.runtime.onMessage.addListener(upload)

// Runs on load, reload, and after browser or extension updates
chrome.runtime.onInstalled.addListener(() => {
  // Setup context menus
  chrome.contextMenus.removeAll(() => {
    config.contextMenus.forEach((from) => {
      chrome.contextMenus.create(from)
    })
  })

  const keys = Object.keys(supply)

  // Retrieve options from store
  chrome.storage.sync.get(keys, (inputs) => {
    const from = Object.keys(inputs)
    const data = from.length === 0 ? supply : inputs

    // No options in store, use defaults
    chrome.storage.sync.set(data)

    chrome.tabs.query({ active: true }, (tabs) => {
      // Just another way of saying `tabs[0]`
      const [tab] = tabs

      update(tab)
    })
  })
})

// Pick an image on click
chrome.browserAction.onClicked.addListener(({ id }) => {
  chrome.tabs.sendMessage(id, { message: '@cyclops/sample' })
})

// Timer management
chrome.storage.onChanged.addListener(({ repeat }) => {
  if (repeat) {
    chrome.storage.sync.get('period', ({ period } = {}) => {
      if (repeat.newValue) {
        chrome.alarms.create('@cyclops', { periodInMinutes: period })
      } else {
        chrome.alarms.clearAll()
      }
    })
  }
})

chrome.alarms.onAlarm.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Any tabs active?
    if (tabs.length) {
      const [{ id, url }] = tabs

      chrome.storage.sync.get('ignore', ({ ignore } = {}) => {
        const enabled = isAllowed([...ignore, 'chrome://'], url)

        if (enabled) {
          // Ask content script for a random image
          chrome.tabs.sendMessage(id, { message: '@cyclops/sample' })
        }
      })
    }
  })
})

// Context menu management
chrome.contextMenus.onClicked.addListener(({ menuItemId, checked, srcUrl: target }, tab) => {
  switch (menuItemId) {
  case '@cyclops-toggle-timer':
    // Adjust timer prefs
    chrome.storage.sync.set({ repeat: checked })
    break
  case '@cyclops-sample':
    // Post
    upload({ source: tab.url, target })
    break
  default:
  }
})

// Tab management
chrome.windows.onFocusChanged.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const [tab] = tabs

    update(tab)
  })
})

chrome.tabs.onUpdated.addListener((tabId, { status }, tab) => {
  if (status === 'complete' && tab.active) {
    update(tab)
  }
})

// New tabs
chrome.tabs.onCreated.addListener(update)

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, update)
})
