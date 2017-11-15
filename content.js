(() => {
  // $$
  const gather = (s, host = document) => Array.from(host.querySelectorAll(s))

  // Remove duplicates from array
  // http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
  const unique = (x = []) => [...new Set(x)]

  // Place random entry in array
  const random = (x = []) => x.splice(Math.floor(Math.random() * x.length), 1)[0]

  // Exclude common cases of impossible imgs
  const review = host => unique(gather('img', host)
    // Filter our lazyloaded imgs, empty src attr
    .filter(img => img.src)
    // Filter our cleargifs, 1x1s
    .filter(img => (img.naturalWidth > 1 && img.naturalHeight > 1))
    // Extract src attr
    .map(img => img.src))

  window.addEventListener('load', () => {
    const frames = gather('iframe')
    const images = review()

    const { origin, hostname: source } = window.location

    // Dig deeper image gathering operations :)
    if (frames.length) {
      // Refresh image list, useful with tumblr photosets
      frames
        // Avoid cross origin issues, include same domain iframes only
        .filter(x => x.src.indexOf(origin) === 0)
        // Get the images inside of the iframes on the page, but only if they pass the checks
        .forEach((x) => {
          const extras = review(x.contentDocument)

          images.push(...extras)
        })
    }

    // Store image indices to choose from
    let guides = []

    // Fired at rate if timer set
    chrome.runtime.onMessage.addListener(({ message }) => {
      // Skip if no images pass the checks or request looks foreign
      if (images && images.length >= 1 && message && message === '@cyclops/sample') {
        // Reset guides array if empty
        if (guides.length === 0) {
          // http://stackoverflow.com/questions/3746725/create-a-javascript-array-containing-1-n
          const g = Array(images.length).keys()

          guides = [...g]
        }

        const needle = random(guides)
        const target = images[needle]

        // Let the background script know
        chrome.runtime.sendMessage({ source, target })
      }
    })
  })
})()
