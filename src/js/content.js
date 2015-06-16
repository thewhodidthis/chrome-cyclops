(function(window, document, undefined) {
  'use strict';

  var total = 0;
  var seeds = [];
  var source = location.hostname;
  var origin = location.origin;

  var getSeed = function _getUniqueRandomSeed(max) {
    // refill unique seeds array if empty
    if (! seeds.length) {
      for (var i = 0; i < max; i += 1) {
        seeds.push(i);
      }
    }

    var idx = Math.floor(Math.random() * seeds.length);
    var val = seeds[idx];

    // remove once seed acquired
    seeds.splice(idx, 1);

    return val;
  };

  var cleanup = function _cleanup(input) {
    var output = input || [];
    // exclude common cases of impossible imgs
    // lazyloaded, empty src attr
    output = output.filter(function _checkSrc(img, idx, self) {
      return img.src;
    });

    // cleargifs, 1x1
    output = output.filter(function _checkSize(img, idx, self) {
      return (img.naturalWidth > 1 && img.naturalHeight > 1);
    });

    // extract src attr
    output = output.map(function _replaceWithSrc(img, idx, self) {
      return img.src;
    });

    // remove duplicates
    output = uniq(output);

    return output;
  };

  var $iframes = document.getElementsByTagName('iframe');
  var iframes = Array.prototype.slice.call($iframes);

  var $images = document.getElementsByTagName('img');
  var images = Array.prototype.slice.call($images);

  images = cleanup(images);
  total = images.length;

  if (total < 1) {
    return;
  }

  // useful with tumblr photosets
  window.addEventListener('load', function _onLoad(e) {
    iframes = iframes.filter(function(iframe) {
      // include same domain iframes only
      return (iframe.src.indexOf(origin) === 0);
    });

    iframes.forEach(function(iframe) {
      var $iframeImages = iframe.contentDocument.getElementsByTagName('img');
      var iframeImages = Array.prototype.slice.call($iframeImages);

      iframeImages = cleanup(iframeImages);

      images = images.concat(iframeImages);
    });
  }, false);

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message === 'alarmfired') {
      var max = images.length;
      var seed = getSeed(max);
      var target = images[seed];

      chrome.runtime.sendMessage({
        incoming: {
          target: target,
          source: source
        }
      });
    }
  });

  // http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
  function uniq(a) {
    var seen = {};

    return a.filter(function(item) {
      return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
  }
})(window, document);
