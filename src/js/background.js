(function(window, document, undefined) {
  'use strict';

  var socket = io.connect('http://cyclops.ws', {
    'reconnectionAttempts': 1
  });
  //var socket = io.connect('http://localhost:8022', {
    //'reconnectionAttempts': 1
  //});

  var connected;
  var watchlist = {};
  var blacklist = [];

  var updateContextMenu = function _updateContextMenu(checked) {
    chrome.contextMenus.update('toggle-timer', {
      checked: checked
    });
  };

  var updateIcon = function _updateIcon(active) {
    var iconPath = 'img/icon19-inactive.png';

    if (active) {
      iconPath = 'img/icon19.png';
    }

    chrome.browserAction.setIcon({
      path: iconPath
    });
  };

  var updateTimer = function _updateTimer(wants) {
    if (wants) {
      chrome.storage.sync.get(['rate', 'freeze'], function(options) {
        var rate = options.rate;
        var freeze = options.freeze;

        if (freeze) {
          chrome.alarms.clearAll();
        } else {
          // create or update
          chrome.alarms.create('cyclops', {
            periodInMinutes: rate
          });
        }
      });
    } else {
      chrome.alarms.clearAll();
    }
  };

  var updateWatchlistDataFor = function _updateWatchlistDataFor(tab, isNew) {
    var tabId = tab.id;
    var tabUrl = tab.url;

    var target = watchlist[tabId] || {};
    var needsWatching = target.loop || true;

    var isNew = (Object.keys(watchlist).indexOf(tabId.toString()) === -1);
    var hasUrlChanged = (typeof target.url === undefined || target.url !== tabUrl);

    var isBlacklisted = blacklist.some(function(url) {
      return tabUrl.indexOf(url) !== -1;
    });

    if (isNew) {
      needsWatching = true;
    }

    //need to check if blacklist has changed
    if ((isNew || hasUrlChanged) && isBlacklisted) {
      needsWatching = false;
    }

    //if (isBlacklisted) {
      //needsWatching = false;
    //}

    target.loop = needsWatching;
    target.url = tabUrl;

    watchlist[tabId] = target;

    console.log('needsWatching', needsWatching);
    console.log('target.loop', target.loop);

    updateContextMenu(needsWatching);

    updateIcon(needsWatching);
    updateTimer(needsWatching);
  };

  socket.on('connect', function(e) {
    // connection established
    chrome.notifications.getPermissionLevel(function(permissionLevel) {
      if (permissionLevel !== 'granted') {
        return;
      }

      var stamp = new Date().toTimeString().split(' ')[0];

      chrome.notifications.create({
        type: 'basic',
        title: 'Cyclops',
        iconUrl: 'img/icon48.png',
        message: stamp + ' - Connected',
        contextMessage: 'Time to feed the beast'
      });
    });

    connected = true;
  });

  socket.on('connect_error', function(e) {
    // run only once
    if (typeof connected !== 'undefined') {
      connected = false;

      return;
    }

    chrome.notifications.getPermissionLevel(function(permissionLevel) {
      if (permissionLevel !== 'granted') {
        return;
      }

      var stamp = new Date().toTimeString().split(' ')[0];

      chrome.notifications.create({
        type: 'basic',
        title: 'Cyclops',
        iconUrl: 'img/icon48-inactive.png',
        message: stamp + ' - Disconnected',
        contextMessage: 'Server is down, try again in a short while'
      });
    });

    connected = false;
  });

  chrome.storage.sync.get('blacklist', function _resetBlacklist(options) {
    blacklist = options.blacklist;
  });

  // runs on load, reload, and after browser or extension updates
  chrome.runtime.onInstalled.addListener(function _onInstalled() {
    // setup context menus
    // available when right clicking on top of images
    chrome.contextMenus.create({
      type: 'normal',
      id: 'feed-the-beast',
      title: 'Feed The Beast',
      contexts: ['image']
    });

    // available when right clicking on browser action action
    chrome.contextMenus.create({
      type: 'checkbox',
      id: 'toggle-timer',
      title: 'Run in background',
      checked: true,
      contexts: ['browser_action']
    });

    chrome.storage.sync.get(['rate', 'freeze', 'notify', 'blacklist'], function(options) {
      if (Object.keys(options).length === 0) {
        options = {
          rate: 1,
          freeze: false,
          notify: false,
          blacklist: ['cyclops.ws', 'mail.yahoo.com', 'mail.google.com', 'docs.google.com']
        };
      }

      chrome.storage.sync.set(options);
    });
  });

  chrome.storage.onChanged.addListener(function _onStorageChanged(changes) {
    if (changes.blacklist) {
      watchlist = {};
      blacklist = changes.blacklist.newValue;
    }

    if (changes.freeze) {
      var freeze = changes.freeze.newValue;

      if (freeze) {
        chrome.alarms.clearAll();
      }

      chrome.contextMenus.update('toggle-timer', {
        enabled: !freeze
      });
    }

    if (changes.rate) {
      var rate = changes.rate.newValue;

      chrome.alarms.getAll(function(alarms) {
        alarms.forEach(function(alarm) {
          alarm.periodInMinutes = rate;
        });
      });
    }
  });

  chrome.tabs.onRemoved.addListener(function _onTabRemoved(tabId, info) {
    delete watchlist[tabId];
  });

  chrome.tabs.onDetached.addListener(function _onTabDetached(tabId, info) {
    delete watchlist[tabId];
  });

  chrome.tabs.onReplaced.addListener(function _onTabReplaced(addedTabId, removedTabId) {
    delete watchlist[removedTabId];
  });

  chrome.tabs.onUpdated.addListener(function _onTabUpdated(tabId, info, tab) {
    var isComplete = (info.status === 'complete');

    if (isComplete) {
      updateWatchlistDataFor(tab);
    }
  });

  chrome.tabs.onActivated.addListener(function _onTabActivated(info) {
    var tabId = info.tabId;

    chrome.tabs.get(tabId, function(tab) {
      updateWatchlistDataFor(tab);
    });
  });

  chrome.contextMenus.onClicked.addListener(function _onContextMenuClicked(info, tab) {
    var menuItemId = info.menuItemId || false;

    if (menuItemId === 'feed-the-beast') {
      var target = info.srcUrl;
      var source = tab.url;

      chrome.runtime.sendMessage({
        incoming: {
          target: target,
          source: source
        }
      });

      return;
    }

    if (menuItemId === 'toggle-timer') {
      var tabId = tab.id;
      var target = watchlist[tabId];
      var needsWatching = info.checked;

      target.loop = needsWatching;

      updateIcon(needsWatching);
      updateTimer(needsWatching);

      return;
    }
  });

  chrome.commands.onCommand.addListener(function(command) {
    if (command === 'toggle_timer') {
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, function(tabs) {
        if (! tabs.length) {
          return;
        }

        var tabId = tabs[0].id;
        var target = watchlist[tabId];
        var needsWatching = !target.loop;

        target.loop = needsWatching;

        updateContextMenu(needsWatching);
        updateIcon(needsWatching);
        updateTimer(needsWatching);

        return;
      });

      return;
    }
  });

  chrome.browserAction.onClicked.addListener(function(tab) {
    var tabId = tab.id;

    chrome.tabs.sendMessage(tabId, {
      message: 'alarmfired'
    });
  });

  chrome.alarms.onAlarm.addListener(function() {
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      if (! tabs.length) {
        return;
      }

      var tabId = tabs[0].id;

      chrome.tabs.sendMessage(tabId, {
        message: 'alarmfired'
      });
    });
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    var incoming = request.incoming || false;

    if (! incoming) {
      return;
    }

    var target = incoming.target;

    if (connected) {
      socket.emit('incoming', target);
    }

    chrome.notifications.getPermissionLevel(function(permissionLevel) {
      if (permissionLevel !== 'granted') {
        return;
      }

      chrome.storage.sync.get('notify', function(options) {
        var notify = options.notify;

        if (! notify) {
          return;
        }

        //http://stackoverflow.com/questions/20035615/using-raw-image-data-from-ajax-request-for-data-uri
        var xhr = new XMLHttpRequest();

        xhr.responseType = 'arraybuffer';
        xhr.open('GET', target, true);

        xhr.onload = function() {
          var blob = new Blob([xhr.response], {
            type: 'image/png'
          });
          var imageUrl = (window.URL || window.webkitURL).createObjectURL(blob);

          if (! imageUrl) {
            return;
          }

          var source = formatUrl(incoming.source);
          var stamp = new Date().toTimeString().split(' ')[0];

          chrome.notifications.create({
            type: 'image',
            title: 'Cyclops',
            iconUrl: 'img/icon48.png',
            message: stamp + ' - ' + source,
            contextMessage: '' + target,
            imageUrl: imageUrl
          });
        };

        xhr.send();
      });
    });
  });

  function formatUrl(target) {
    // remove protocol
    var url = target.replace(/.*?:\/\//g, '');

    // remove trailing slash from end of string
    url = url.replace(/\/$/, '');

    return url;
  }
})(window, document);
