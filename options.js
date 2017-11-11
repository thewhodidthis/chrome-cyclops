((window, document) => {
  // Id selectors for buttons and form elements
  const buttonIds = 'flash,reset,save'.split(',')
  const optionIds = 'blacklist,freeze,notify,rate'.split(',')

  // Turn above into key value pairs for future reference
  const formElements = buttonIds
    .concat(optionIds)
    .reduce((o, k) => Object.assign(o, { [k]: document.getElementById(k) }), {})

  // Only matches domain like strings, borrowed from Feedly
  const isUrl = x => (x.match(/^((?:(?:(?:\w[.\-+]?)*)\w)+)((?:(?:(?:\w[.\-+]?){0,62})\w)+)\.(\w{2,6})$/))

  // Based on http://underscorejs.org/#escape
  const escapeHtml = str => String(str)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;')

  // Cleanup blacklisted urls
  const parseUrls = (input) => {
    let output = escapeHtml(input).split(/\n/)

    // Trim whitespace
    output = output.map(url => url.trim())

    // Remove empty lines
    output = output.filter(url => url.length)

    // Dedupe
    output = output.filter((url, index, array) => array.indexOf(url) === index)

    // Check for gobbledygooked list entries and just silently ignore those invalid
    output = output.filter(url => isUrl(url))

    return output
  }

  const popMessage = (msg) => {
    // Set flash mesage, escaped on input
    formElements.flash.innerHTML = msg || ''

    // Clear out after a short while
    setTimeout(() => {
      formElements.flash.textContent = ''
    }, 2000)
  }

  const getForm = () => {
    const blacklist = parseUrls(formElements.blacklist.value)
    const freeze = !!formElements.freeze.checked
    const notify = !!formElements.notify.checked

    // Timer rate allowed no less than a minute
    const rate = parseFloat(formElements.rate.value)

    return { blacklist, freeze, notify, rate: Math.max(1, rate) }
  }

  // Update the form given a set of values for each setting
  const setForm = ({ rate, notify, freeze, blacklist } = {}) => {
    formElements.rate.value = rate
    formElements.notify.checked = notify
    formElements.freeze.checked = freeze

    // Parse blacklist array into line separated strings
    formElements.blacklist.value = blacklist.reduce((a, b) => (a.length ? `${a}\n${b}` : b), '')
  }

  chrome.storage.sync.get(optionIds, (options) => {
    // Update form with options got
    setForm(options)

    // Hit the reset button to revert form to previous settings
    formElements.reset.addEventListener('click', () => {
      // Reset from storage
      setForm(options)

      // Show a brief message
      popMessage('Options reset, hit save to apply!')
    })

    // Click save to store the options, update the form if successful
    formElements.save.addEventListener('click', () => {
      const settings = getForm()

      chrome.storage.sync.set(settings, () => {
        // Success, let the form reflect the changes
        setForm(settings)

        // Show a brief message
        popMessage('Options saved!')
      })
    })
  })
})(window, document)
