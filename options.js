(() => {
  // Matches domain like strings, borrowed from Feedly
  const urlExp = /^((?:(?:(?:\w[.\-+]?)*)\w)+)((?:(?:(?:\w[.\-+]?){0,62})\w)+)\.(\w{2,6})$/

  // Based on http://underscorejs.org/#escape
  const encode = s => String(s)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;')

  // Cleanup blacklisted urls
  const filter = s => encode(s)
    .split(/\n/)
    // Trim whitespace
    .map(x => x.trim())
    // Remove empty lines
    .filter(x => x.length)
    // Dedupe
    .filter((x, k, a) => a.indexOf(x) === k)
    // Check for gobbledygooked list entries and just silently ignore those invalid
    .filter(x => x.match(urlExp))

  const gather = (o, k) => Object.assign(o, { [k]: document.getElementById(k) })

  const config = 'ignore,notify,period'.split(',')
  const inputs = config.reduce(gather, {})

  const { flash, reset, store } = 'flash,reset,store'.split(',').reduce(gather, {})

  const signal = (text) => {
    // Set flash mesage, escaped on input
    flash.innerHTML = text || ''

    // Clear out after a short while
    setTimeout(() => {
      flash.textContent = ''
    }, 2000)
  }

  // Parse blacklist array into line separated strings
  const lineup = (a, b) => (a.length ? `${a}\n${b}` : b)

  // Update the form given a set of values for each setting
  const render = ({ ignore = '', notify, period } = {}) => {
    inputs.ignore.value = ignore.reduce(lineup, '')
    inputs.notify.checked = notify
    inputs.period.value = period
  }

  const review = () => ({
    ignore: filter(inputs.ignore.value),
    notify: !!inputs.notify.checked,
    period: Math.max(1, parseFloat(inputs.period.value))
  })

  chrome.storage.sync.get(config, (data) => {
    // Update form with options got
    render(data)

    // Hit the reset button to revert form to previous settings
    reset.addEventListener('click', () => {
      // Reset from storage
      render(data)

      // Show a brief message
      signal('Options reset, hit save to apply!')
    })

    // Click save to store the options, update the form if successful
    store.addEventListener('click', () => {
      const form = review()

      chrome.storage.sync.set(form, () => {
        // Success, let the form reflect the changes
        render(form)

        // Show a brief message
        signal('Options saved!')
      })
    })
  })
})()
