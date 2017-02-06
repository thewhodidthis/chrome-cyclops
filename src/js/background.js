// Default settings
const defaults = {
  // Alert how fast
  rate: 1,

  // Host url, just use localhost for now
  host: ('update_url' in chrome.runtime.getManifest()) ? 'https://cyclops.ws/io' : 'http://localhost:8022/io',

  // Enabled
  freeze: false,

  // Wants notifications
  notify: false,

  // Excludes
  blacklist: [
    'localhost',
    'cyclops.ws',
    'mail.yahoo.com',
    'mail.google.com',
    'docs.google.com'
  ]
};

// Tabs currently being watched
// Maps are available Chrome v38 onwards according to MDN
const watchlist = new Map();

// Listing following methods from the more generic to the more project specific
const getTimestamp = () => new Date().toTimeString().split(' ')[0];

// Clean up image urls, remove protocol, remove trailing slash from end of string
const getUrl = url => url.replace(/.*?:\/\//g, '').replace(/\/$/, '');

// For now, a super simple xhr wrapper to help with the network requests
// TODO: Use fetch or web workers when the server script is done at some point?
const sendRequest = (options, callback) => {
  const xhr = new XMLHttpRequest();
  const url = options.url || defaults.host;

  if (options.responseType) {
    xhr.responseType = options.responseType;
  }

  if (options.method === 'PUT') {
    xhr.open('PUT', url);
  } else {
    xhr.open('GET', url, true);
  }

  // TODO: Where is my error checking?
  xhr.onload = () => {
    callback(xhr.response);
  };

  xhr.send(options.data || '');
};

// Yeah, pyramid of doom
const showNotification = (incoming, imageUrl) => {
  // Check permissions
  chrome.notifications.getPermissionLevel((permissionLevel) => {
    // If notifications allowed
    if (permissionLevel === 'granted') {
      // Check notification preferences
      chrome.storage.sync.get('notify', (options) => {
        // If notifications desired
        if (options.notify) {
          chrome.notifications.create({
            type: 'image',
            title: 'Cyclops',
            iconUrl: 'img/blue/icon48.png',
            message: `${getTimestamp()} - ${getUrl(incoming.source)}`,
            contextMessage: incoming.target,
            imageUrl
          });
        }
      });
    }
  });
};

// File new image requests
const process = (request) => {
  // TODO: Condense
  const incoming = request.cyclops;

  // Naively tackling false alarms
  if (incoming && incoming.target) {
    sendRequest({
      url: incoming.target,
      responseType: 'arraybuffer'
    }, (response) => {
      // More: http://stackoverflow.com/questions/20035615/using-raw-image-data-from-ajax-request-for-data-uri
      const data = new Blob([response]);
      const dataUrl = window.URL.createObjectURL(data);

      // Save the image
      sendRequest({
        method: 'PUT',
        data
      }, () => {
        // Alert
        showNotification(incoming, dataUrl);
      });
    });
  }
};

// Push new tabs to the watchlist and sets icon and timers accordingly
const refresh = (tab, checked) => {
  // Get from watchlist or construct new, setting watch flag in the process
  const entry = watchlist.get(tab.id) || {
    url: tab.url,
    checked
  };

  chrome.storage.sync.get(['blacklist', 'freeze', 'rate'], (options) => {
    const isDefined = check => check !== undefined;
    const isEnabled = ![...options.blacklist, 'chrome://'].some(str => tab.url.indexOf(str) !== -1);
    const isChecked = isDefined(checked) ? checked : isDefined(entry.checked) ? entry.checked : !options.freeze;

    if (isEnabled && isChecked) {
      chrome.alarms.create('@cyclops', {
        periodInMinutes: options.rate
      });
    } else {
      chrome.alarms.clearAll();
    }

    chrome.browserAction.setIcon({
      path: isEnabled ? 'img/blue/icon19.png' : 'img/gray/icon19.png'
    });

    chrome.contextMenus.update('@cyclops-toggle-timer', {
      enabled: isEnabled && !options.freeze,
      checked: isChecked && !options.freeze
    });

    // Finally update the tab entry in the watchlist
    watchlist.set(tab.id, Object.assign(entry, { checked: isChecked }));
  });
};

chrome.runtime.onMessage.addListener(process);

// Setup context menus, reset options
// Runs on load, reload, and after browser or extension updates
chrome.runtime.onInstalled.addListener(() => {
  // Available when right clicking on browser action
  chrome.contextMenus.create({
    id: '@cyclops-toggle-timer',
    type: 'checkbox',
    title: 'Run in background',
    contexts: ['browser_action'],
    checked: false
  });

  // Available when right clicking on top of images
  chrome.contextMenus.create({
    id: '@cyclops-sample',
    type: 'normal',
    title: 'Feed the beast',
    contexts: ['image']
  });

  // Retrieve options from store
  chrome.storage.sync.get(Object.keys(defaults), (options) => {
    // No options in store, use defaults
    chrome.storage.sync.set(Object.keys(options).length === 0 ? defaults : options);

    // Touch watchlist
    chrome.tabs.query({ active: true }, (tab) => {
      // Update accordingly
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
        cyclops: {
          source: tab.url,
          target: info.srcUrl
        }
      });
      break;
    default:
      break;
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
        message: '@cyclops/sample'
      });
    }
  });
});

// Pick an image on each click
chrome.browserAction.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, {
    message: '@cyclops/sample'
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

