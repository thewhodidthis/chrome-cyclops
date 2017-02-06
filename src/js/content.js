((window, document) => {
  // Convert node list into array
  // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
  const $$ = elements => Array.from(elements);

  // For removing duplicates
  // http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
  const uniq = a => [...new Set(a)];

  // Return a random entry and adjust input accordingly
  const getRandom = (seeds = []) => seeds.splice(Math.floor(Math.random() * seeds.length), 1)[0];

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

  // Dig deeper image gathering operations :)
  window.addEventListener('load', () => {
    const images = getImages();
    const iframes = $$(document.getElementsByTagName('iframe'));

    // Refresh image list
    if (iframes.length) {
      // Useful with tumblr photosets
      iframes
        // Avoid cross origin issues, include same domain iframes only
        .filter(iframe => iframe.src.indexOf(location.origin) === 0)
        // Get the images inside of the iframes on the page, but only if they pass the checks
        .forEach(iframe => images.push(...getImages(iframe.contentDocument)));
    }

    // Store image indices to choose from
    let seeds = [];

    // Fired at rate if timer set
    chrome.runtime.onMessage.addListener((request) => {
      // Skip if no images pass the checks or request looks foreign
      if (images && images.length >= 1 && request.message === '@cyclops/sample') {
        // Reset seeds array if empty
        // http://stackoverflow.com/questions/3746725/create-a-javascript-array-containing-1-n
        if (seeds.length === 0) {
          seeds = [...Array(images.length).keys()];
        }

        // Let the background script know
        chrome.runtime.sendMessage({
          cyclops: {
            target: images[getRandom(seeds)],
            source: location.hostname,
          },
        });
      }
    });
  });
})(window, document);
