((window, document) => {
  // Store images to choose from
  // Could this be a map containing images and seeds?
  let seeds = [];

  // Convert node list into array
  // More: http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
  const $$ = elements => Array.from(elements);

  // Dedupe
  // From: http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
  const uniq = a => [...new Set(a)];

  // Return a random image and adjust the image array accordingly
  // TODO: This is not perfect yet
  const getSeed = (max) => {
    // Refill unique seeds array if empty the es6 way
    // More: http://stackoverflow.com/questions/3746725/create-a-javascript-array-containing-1-n
    // seeds = seeds.length ? seeds : [...Array(max).keys()];
    seeds = (seeds.length && seeds.length >= max) ? seeds : [...Array(max).keys()];

    // Index between 0 and max
    const idx = Math.floor(Math.random() * max);

    // The image source
    const val = seeds[idx];

    // Remove once seed acquired
    seeds.splice(idx, 1);

    return val;
  };

  // Exclude common cases of impossible imgs
  const getImages = (host = document) => {
    let output = $$(host.getElementsByTagName('img')) || [];

    // Filter our lazyloaded imgs, empty src attr
    output = output.filter(img => img.src);

    // Filter our cleargifs, 1x1s
    output = output.filter(img => (img.naturalWidth > 1 && img.naturalHeight > 1));

    // Extract src attr
    output = output.map(img => img.src);

    // Dedupe
    output = uniq(output);

    return output;
  };

  const images = getImages();

  // Fired at rate if timer set
  chrome.runtime.onMessage.addListener((request) => {
    // Skip if no images pass the checks or request looks foreign
    if (images && images.length > 1 && request.message === '@cyclops/sample') {
      // Tell the background script
      chrome.runtime.sendMessage({
        cyclops: {
          target: images[getSeed(images.length)],
          source: location.hostname
        }
      });
    }
  });

  // Dig deeper image gathering operations :)
  window.addEventListener('load', () => {
    const iframes = $$(document.getElementsByTagName('iframe'));

    // Refresh image list
    if (iframes.length) {
      // Useful with tumblr photosets
      iframes
        // Avoid cross origin issues, include same domain iframes only
        .filter(i => i.src.indexOf(location.origin) === 0)
        // Get the images inside of the iframes on the page, but only if they pass the checks
        .forEach(iframe => images.push(...getImages(iframe.contentDocument)));
    }
  });
})(window, document);
