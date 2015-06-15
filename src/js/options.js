(function(window, document, undefined) {
  'use strict';

  //cache form elements
  var $save = document.getElementById('save');
  var $reset = document.getElementById('reset');
  var $flash = document.getElementById('flash');

  var $rate = document.getElementById('rate');
  var $freeze = document.getElementById('freeze');
  var $notify = document.getElementById('notify');
  var $blacklist = document.getElementById('blacklist');

  var createFlashMessage = function _createFlashMessage(msg) {
    if(! msg) {
      return;
    }

    // set flash mesage, escaped on input
    $flash.innerHTML = msg;

    // clear out after a short while
    setTimeout(function() {
      $flash.textContent = '';
    }, 2000);
  };

  var updateForm = function _updateForm(options) {
    var options = options || {};

    var sampleRate = options.rate || 1;
    var wantsNotifications = options.notify || false;
    var wantsNoTimer = options.freeze || false;

    var blacklistedUrls = options.blacklist || [];
    var blacklistedUrlsText = '';

    blacklistedUrls.forEach(function(url, idx, list) {
      blacklistedUrlsText += url + "\n";
    });

    // set form inputs
    $rate.value = sampleRate;
    $notify.checked = wantsNotifications;
    $freeze.checked = wantsNoTimer;
    $blacklist.value = blacklistedUrlsText;
  };

  var getFormData = function _getFormData() {
    var options = {};

    var sampleRate = parseFloat($rate.value);
    var wantsNotifications = !!$notify.checked;
    var wantsNoTimer = !!$freeze.checked;
    var blacklistedUrls = escapeHtml($blacklist.value).split(/\n/);

    // check for double entries?
    // http://stackoverflow.com/questions/7376598/in-javascript-how-do-i-check-if-an-array-has-duplicate-values

    // cleanup
    for (var i = 0, total = blacklistedUrls.length; i < total; i += 1) {
      var target = blacklistedUrls[i];

      // trim whitespace
      if (target) {
        blacklistedUrls[i] = target.trim();
      }

      // remove empty lines
      if (target === '') {
        blacklistedUrls.splice(i, 1);

        i--;
      }
    }

    // check for gobbledygooked list entries
    for (var i = 0, total = blacklistedUrls.length; i < total; i += 1) {
      var target = blacklistedUrls[i];

      if (! isUrlValid(target)) {
        if (target.length > 8) {
          target = '<span>' + target.substring(0, 8) + '</span>&hellip;';
        } else {
          target = '<span>' + target + '</span>';
        }

        createFlashMessage('Sorry, ' + target + ' looks fishy!');

        return false;
      }
    }

    options.rate = sampleRate;
    options.notify = wantsNotifications;
    options.freeze = wantsNoTimer;
    options.blacklist = blacklistedUrls;

    return options;
  };

  // on show: update form, attach button handlers
  chrome.storage.sync.get(['rate', 'freeze', 'notify', 'blacklist'], function(options) {
    $save.addEventListener('click', function(e) {
      var options = getFormData();

      if (options) {
        chrome.storage.sync.set(options, function() {
          updateForm(options);

          createFlashMessage('Options saved!');
        });
      }
    });

    $reset.addEventListener('click', function(e) {
      updateForm(options);

      createFlashMessage('Options reset, hit save to apply!');
    });

    updateForm(options);
  });

  // only matches domain like strings, borrowed from Feedly
  function isUrlValid(url) {
    var reg = new RegExp(/^((?:(?:(?:\w[\.\-\+]?)*)\w)+)((?:(?:(?:\w[\.\-\+]?){0,62})\w)+)\.(\w{2,6})$/);

    return url.match(reg);
  }

  // based on http://underscorejs.org/#escape
  function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\//g, "&#x2F;");
  }
})(window, document);
