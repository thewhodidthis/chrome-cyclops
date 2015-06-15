(function(window, document, undefined) {
  'use strict';

  var $images = document.getElementsByTagName('img');
  var images = Array.prototype.slice.call($images);

  // filter out duplicates as well?
  images = images.filter(function _checkSrc(img) {
    // exclude common cases of impossible imgs (lazyloaded: empty src attr, cleargifs: 1x1)
    return isNotEmptyString(img.src) && isImageBigEnough(img);
  });

  var total = images.length;

  if (total < 1) {
    return;
  }

  var seeds = [];
  var source = location.hostname;
  var origin = location.origin;

  var getSeed = function _getUniqueRandomSeed(total) {
    // refill unique seed array if empty
    if (! seeds.length) {
      for (var i = 0; i < total; i+= 1) {
        seeds.push(i);
      }
    }

    var idx = Math.floor(Math.random() * seeds.length);
    var val = seeds[idx];

    // remove once value got
    seeds.splice(idx, 1);

    return val;
  };

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message === 'alarmfired') {
      var seed = getSeed(total);
      var target = images[seed].src;

      chrome.runtime.sendMessage({
        incoming: {
          target: target,
          source: source
        }
      });
    }
  });

  // useful with tumblr photosets
  window.addEventListener('load', function _onLoad(e) {
    var $iframes = document.getElementsByTagName('iframe');
    var iframes = Array.prototype.slice.call($iframes);

    iframes = iframes.filter(function(iframe) {
      // include same domain iframes only
      return (iframe.src.indexOf(origin) === 0);
    });

    iframes.forEach(function(iframe) {
      var $iframeImages = iframe.contentDocument.getElementsByTagName('img');
      var iframeImages = Array.prototype.slice.call($iframeImages);

      images = images.concat(iframeImages);
      total = images.length;
    });
  }, false);

  function isNotEmptyString(target) {
    return (target != '');
  }

  function isImageBigEnough(target) {
    return (target.naturalWidth > 1 && target.naturalHeight > 1);
  }
})(window, document);
