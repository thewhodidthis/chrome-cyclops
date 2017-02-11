// Defaults
const settings = {
  // Host url, just use localhost for now
  host: ('update_url' in chrome.runtime.getManifest()) ? 'https://cyclops.ws/io' : 'http://localhost:8022/io',

  // Auto refresh how often
  rate: 1,

  // Timer off
  freeze: false,

  // Wants notifications
  notify: false,

  // Disable when visiting these pages
  blacklist: [
    'localhost',
    'cyclops.ws',
    'mail.yahoo.com',
    'mail.google.com',
    'docs.google.com',
  ],

  // Notification defaults
  notification: {
    type: 'basic',
    title: 'Cyclops',
    iconUrl: 'img/icon48.png',
  },

  // Ref menus post create
  contextMenus: [
    {
      id: '@cyclops-sample',
      type: 'normal',
      title: 'Feed the beast',
      contexts: ['image'],
    },
    {
      id: '@cyclops-toggle-timer',
      type: 'checkbox',
      title: 'Run in background',
      contexts: ['browser_action'],
      checked: false,
    },
  ],
};

// Tabs on watch, Chrome v38 onwards
const watchlist = new Map();

// Format curren time
const getTimestamp = () => new Date().toTimeString().split(' ')[0];

// Clean up image urls, remove protocol, remove trailing slash from end of string
const getUrl = url => url.replace(/.*?:\/\//g, '').replace(/\/$/, '');

// Check response status
const getStatus = (response) => {
  // Success
  if (response.status >= 200 && response.status < 300) {
    return Promise.resolve(response);
  }

  // Errors
  return Promise.reject(new Error(`${response.status} / ${response.statusText}`));
};

// Read response data into an array buffer
const getBuffer = input => input.arrayBuffer();

// Notify
const popNotice = (details) => {
  // Check notification preferences
  chrome.storage.sync.get('notify', (options) => {
    // If notifications desired
    if (options.notify) {
      const notice = Object.assign({}, settings.notification, details);

      chrome.notifications.create(notice, notificationId => notificationId);
    }
  });
};

// File new image requests
const process = (message) => {
  const source = message && message.source;
  const target = message && message.target;

  // False alarm, need both
  if (!source || !target) {
    return;
  }

  fetch(target)
    .then(getStatus)
    .then(getBuffer)
    .then(arrayBuffer => fetch(settings.host, {
      body: arrayBuffer,
      method: 'PUT',
    })
    .then(getStatus)
    .then(() => {
      // Image type notifications accept blob urls
      const blob = new Blob([arrayBuffer]);
      const imageUrl = window.URL.createObjectURL(blob);

      popNotice({
        type: 'image',
        imageUrl,
        message: `${getTimestamp()} - ${getUrl(source)}`,
        contextMessage: target,
      });
    }))
    .catch((error) => {
      // Show errors
      popNotice({
        message: `${getTimestamp()} - ${error.message}`,
        contextMessage: (error.name === 'Error') ? target : settings.host,
      });
    });
};

// Push new tabs to the watchlist, set icon and timers accordingly
const refresh = (tab = { url: '' }, checked) => {
  // Get from watchlist or create setting watch flag in the process
  const entry = watchlist.get(tab.id) || {
    checked,
    url: tab.url,
  };

  chrome.storage.sync.get(['blacklist', 'freeze', 'rate'], (options) => {
    const isDefined = check => check !== undefined;
    const isEnabled = ![...options.blacklist, 'chrome://'].some(str => tab.url.indexOf(str) !== -1);
    const isChecked = isDefined(checked)
      ? checked
      : isDefined(entry.checked) && entry.checked;
    const wantsTimer = isEnabled && isChecked && !options.freeze;

    if (wantsTimer) {
      chrome.browserAction.setIcon({ path: 'img/icon19-hi.png' });
      chrome.alarms.create('@cyclops', {
        periodInMinutes: options.rate,
      });
    } else {
      chrome.browserAction.setIcon({
        path: isEnabled ? 'img/icon19.png' : 'img/icon19-lo.png',
      });
      chrome.alarms.clearAll();
    }

    if (settings.contextMenus.indexOf('@cyclops-toggle-timer') > -1) {
      chrome.contextMenus.update('@cyclops-toggle-timer', {
        enabled: isEnabled && !options.freeze,
        checked: wantsTimer,
      });
    }

    // Finally update the tab entry in the watchlist
    watchlist.set(tab.id, Object.assign(entry, { checked: isChecked }));
  });
};

chrome.runtime.onMessage.addListener(process);

// Runs on load, reload, and after browser or extension updates
chrome.runtime.onInstalled.addListener(() => {
  // Setup context menus
  chrome.contextMenus.removeAll(() => {
    // Save ids
    settings.contextMenus = settings.contextMenus.map(props => chrome.contextMenus.create(props));
  });

  // Retrieve options from store
  chrome.storage.sync.get(Object.keys(settings), (options) => {
    // No options in store, use defaults
    chrome.storage.sync.set(Object.keys(options).length === 0 ? settings : options);

    // Touch watchlist
    chrome.tabs.query({ active: true }, (tab) => {
      refresh(tab[0]);
    });
  });
});

// Context menu management
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Which menu is this?
  switch (info.menuItemId) {
    case '@cyclops-toggle-timer':
      refresh(tab, info.checked);
      break;
    case '@cyclops-sample':
      // Post the image
      process({
        source: tab.url,
        target: info.srcUrl,
      });
      break;
    default:
  }
});

// Shortcut management
chrome.commands.onCommand.addListener((command) => {
  if (command === '@cyclops-toggle-timer') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Any tabs open?
      if (tabs.length) {
        refresh(tabs[0], !watchlist.get(tabs[0].id).checked);
      }
    });
  }
});

// Timer management
chrome.alarms.onAlarm.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // If multiple tabs are present
    if (tabs.length) {
      // Ask content script for a random image
      chrome.tabs.sendMessage(tabs[0].id, {
        message: '@cyclops/sample',
      });
    }
  });
});

// Pick an image on click
chrome.browserAction.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, {
    message: '@cyclops/sample',
  });
});

// Reset watchlist if blacklist has changed
chrome.storage.onChanged.addListener((changes) => {
  // Start from scratch just in case
  if (changes.blacklist) {
    watchlist.clear();
  }
});

// Tab management
// Track tab changes
chrome.windows.onFocusChanged.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length) {
      refresh(tabs[0]);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) {
    refresh(tab);
  }
});

chrome.tabs.onActivated.addListener((info) => {
  chrome.tabs.get(info.tabId, refresh);
});

// Track new tabs
chrome.tabs.onCreated.addListener(refresh);

// Remove from watchlist when,
// 1. Tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  watchlist.delete(tabId);
});

// 2. Tab is detached
chrome.tabs.onDetached.addListener((tabId) => {
  watchlist.delete(tabId);
});

// 3. Tab is replaced
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  watchlist.delete(removedTabId);
});

