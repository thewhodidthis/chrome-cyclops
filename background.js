// Config
const manifest = chrome.runtime.getManifest()
const settings = {
  // Host url
  host: ('update_url' in manifest) ? 'https://zzzxzzz.xyz/io' : 'http://localhost:8011/io',

  // Auto refresh how often
  rate: 1,

  // Timer off
  freeze: false,

  // Wants notifications
  notify: false,

  // Disable when visiting these pages
  blacklist: [
    'localhost',
    'zzzxzzz.xyz',
    '011.thewhodidthis.com',
    'mail.yahoo.com',
    'mail.google.com',
    'docs.google.com'
  ],

  // Notification defaults
  notice: {
    type: 'basic',
    title: 'Cyclops',
    iconUrl: 'assets/icon.png'
  },

  // Ref menus post create
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

// Tabs on watch, Chrome v38 onwards
const watchlist = new Map()

// Check whether a boolean is defined
const isDefined = check => check !== undefined

// Array contains value?
const inArray = (arr, val) => arr.some(str => val.indexOf(str) !== -1)

// Format curren time
const getTimestamp = () => new Date().toTimeString().split(' ')[0]

// Prefix timestamp
const getMessage = msg => `${getTimestamp()} - ${msg}`

// Read response data into an array buffer
const getBuffer = input => input.arrayBuffer()

// Clean up image urls, remove protocol, remove trailing slash from end of string
const getUrl = url => url.replace(/.*?:\/\//g, '').replace(/\/$/, '')

// Check response status
const getStatus = (response) => {
  // Success
  if (response.status >= 200 && response.status < 300) {
    return Promise.resolve(response)
  }

  // Errors
  return Promise.reject(new Error(`${response.status} / ${response.statusText}`))
}

// Notify
const popNotice = (notice) => {
  // Check notification preferences
  chrome.storage.sync.get('notify', ({ notify } = {}) => {
    // If notifications desired
    if (notify) {
      chrome.notifications.create(Object.assign({}, settings.notice, notice))
    }
  })
}

// File new image requests
const process = ({ source, target } = {}) => fetch(target)
  .then(getStatus)
  .then(getBuffer)
  .then(body => fetch(settings.host, { body, method: 'PUT' })
    .then(getStatus)
    .then(() => {
      // Image type notifications accept blob urls
      const blob = new Blob([body])
      const from = getUrl(source)

      const message = getMessage(from)
      const imageUrl = window.URL.createObjectURL(blob)

      popNotice({
        imageUrl,
        message,
        contextMessage: target,
        type: 'image'
      })
    }))
  .catch(({ message, name }) => {
    // Show errors
    popNotice({
      message: getMessage(message),
      contextMessage: name === 'Error' ? target : settings.host
    })
  })

// Push new tabs to the watchlist, set icon and timers accordingly
const refresh = (tab = { url: '' }, checked) => {
  // Get from watchlist or create setting watch flag in the process
  const entry = watchlist.get(tab.id) || {
    checked,
    url: tab.url
  }

  chrome.storage.sync.get(['blacklist', 'freeze', 'rate'], (options) => {
    const isEnabled = !inArray([...options.blacklist, 'chrome://'], entry.url)
    const isChecked = isDefined(checked) ? checked : isDefined(entry.checked) && entry.checked
    const isAlarmed = isEnabled && isChecked && !options.freeze

    if (isAlarmed) {
      chrome.browserAction.setIcon({ path: 'assets/icon.png' })
      chrome.alarms.create('@cyclops', {
        periodInMinutes: options.rate
      })
    } else {
      chrome.browserAction.setIcon({
        path: isEnabled ? 'assets/icon.png' : 'assets/icon-alt.png'
      })
      chrome.alarms.clearAll()
    }

    if (settings.contextMenus.indexOf('@cyclops-toggle-timer') > -1) {
      chrome.contextMenus.update('@cyclops-toggle-timer', {
        enabled: isEnabled && !options.freeze,
        checked: isAlarmed
      })
    }

    // Finally update the tab entry in the watchlist
    watchlist.set(tab.id, Object.assign(entry, { checked: isChecked }))
  })
}

chrome.runtime.onMessage.addListener(process)

// Runs on load, reload, and after browser or extension updates
chrome.runtime.onInstalled.addListener(() => {
  // Setup context menus
  chrome.contextMenus.removeAll(() => {
    // Save ids
    settings.contextMenus = settings.contextMenus.map(props => chrome.contextMenus.create(props))
  })

  // Retrieve options from store
  chrome.storage.sync.get(Object.keys(settings), (options) => {
    // No options in store, use defaults
    chrome.storage.sync.set(Object.keys(options).length === 0 ? settings : options)

    // Touch watchlist
    chrome.tabs.query({ active: true }, (tab) => {
      refresh(tab[0])
    })
  })
})

// Pick an image on click
chrome.browserAction.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, {
    message: '@cyclops/sample'
  })
})

// Timer management
chrome.alarms.onAlarm.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Any tabs active?
    if (tabs.length) {
      // Ask content script for a random image
      chrome.tabs.sendMessage(tabs[0].id, {
        message: '@cyclops/sample'
      })
    }
  })
})

// Context menu management
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Which menu is this?
  switch (info.menuItemId) {
  case '@cyclops-toggle-timer':
    refresh(tab, info.checked)
    break
  case '@cyclops-sample':
    // Post the image
    process({
      source: tab.url,
      target: info.srcUrl
    })
    break
  default:
  }
})

// Shortcut management
chrome.commands.onCommand.addListener((command) => {
  if (command === '@cyclops-toggle-timer') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // This is rare but it does happen that command is called without open windows
      if (tabs.length) {
        refresh(tabs[0], !watchlist.get(tabs[0].id).checked)
      }
    })
  }
})

// Tab management
chrome.windows.onFocusChanged.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    refresh(tabs[0])
  })
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, refresh)
})

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) {
    refresh(tab)
  }
})

// New tabs
chrome.tabs.onCreated.addListener(refresh)

// Remove from watchlist
chrome.tabs.onRemoved.addListener((tabId) => {
  watchlist.delete(tabId)
})

chrome.tabs.onDetached.addListener((tabId) => {
  watchlist.delete(tabId)
})

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  watchlist.delete(removedTabId)
})

// Reset watchlist if blacklist has changed
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blacklist) {
    watchlist.clear()
  }
})
