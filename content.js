((window, document) => {
  // Convert node list into array
  // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
  const $$ = elements => Array.from(elements)

  // Remove duplicates from array
  // http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
  const getUnique = (array = []) => [...new Set(array)]

  // Pop a random entry in array
  const getRandom = (array = []) => array.splice(Math.floor(Math.random() * array.length), 1)[0]

  // Exclude common cases of impossible imgs
  const getImages = (host = document) => {
    let output = $$(host.getElementsByTagName('img')) || []

    // Filter our lazyloaded imgs, empty src attr
    output = output.filter(img => img.src)

    // Filter our cleargifs, 1x1s
    output = output.filter(img => (img.naturalWidth > 1 && img.naturalHeight > 1))

    // Extract src attr
    output = output.map(img => img.src)

    // Dedupe
    output = getUnique(output)

    return output
  }

  window.addEventListener('load', () => {
    const images = getImages()
    const iframes = $$(document.getElementsByTagName('iframe'))

    // Dig deeper image gathering operations :)
    if (iframes.length) {
      // Refresh image list, useful with tumblr photosets
      iframes
        // Avoid cross origin issues, include same domain iframes only
        .filter(iframe => iframe.src.indexOf(location.origin) === 0)
        // Get the images inside of the iframes on the page, but only if they pass the checks
        .forEach(iframe => images.push(...getImages(iframe.contentDocument)))
    }

    // Store image indices to choose from
    let seeds = []

    // Fired at rate if timer set
    chrome.runtime.onMessage.addListener((request) => {
      // Skip if no images pass the checks or request looks foreign
      if (images && images.length >= 1 && request.message === '@cyclops/sample') {
        // Reset seeds array if empty
        // http://stackoverflow.com/questions/3746725/create-a-javascript-array-containing-1-n
        if (seeds.length === 0) {
          seeds = [...Array(images.length).keys()]
        }

        // Let the background script know of the image chosen
        chrome.runtime.sendMessage({
          source: location.hostname,
          target: images[getRandom(seeds)]
        })
      }
    })
  })
})(window, document)
