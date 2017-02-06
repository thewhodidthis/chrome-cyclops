((window, document) => {
  // Id selectors for buttons and form elements
  const buttonIds = 'flash,reset,save'.split(',');
  const optionIds = 'blacklist,freeze,notify,rate'.split(',');

  // Cache form elements
  const formElements = buttonIds
    .concat(optionIds)
    .reduce((obj, idx) => Object.assign(obj, {
      [idx]: document.getElementById(idx),
    }), {});

  // Only matches domain like strings, borrowed from Feedly
  const isUrl = url => (url.match(/^((?:(?:(?:\w[.\-+]?)*)\w)+)((?:(?:(?:\w[.\-+]?){0,62})\w)+)\.(\w{2,6})$/));

  // Based on http://underscorejs.org/#escape
  const escapeHtml = str => String(str)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');

  const parseUrls = (input) => {
    // Cleanup blacklist
    let output = escapeHtml(input).split(/\n/);

    // Trim whitespace
    output = output.map(url => url.trim());

    // Remove empty lines
    output = output.filter(url => url.length);

    // Dedupe
    output = output.filter((url, index, array) => array.indexOf(url) === index);

    // Check for gobbledygooked list entries and just silently ignore those invalid
    output = output.filter(url => isUrl(url));

    return output;
  };

  const popMessage = (msg) => {
    // Set flash mesage, escaped on input
    formElements.flash.innerHTML = msg || '';

    // Clear out after a short while
    setTimeout(() => {
      formElements.flash.textContent = '';
    }, 2000);
  };

  const getForm = () => {
    const blacklist = parseUrls(formElements.blacklist.value);
    const freeze = !!formElements.freeze.checked;
    const notify = !!formElements.notify.checked;

    // Minimum timer rate allowed is one minute
    const rate = Math.max(1, parseFloat(formElements.rate.value));

    return { blacklist, freeze, notify, rate };
  };

  // Update the form given a set of values for each setting
  const setForm = (options) => {
    formElements.rate.value = options.rate;
    formElements.notify.checked = options.notify;
    formElements.freeze.checked = options.freeze;

    // Parse blacklist array into line separated strings
    formElements.blacklist.value = options.blacklist.reduce((a, b) => (a.length ? `${a}\n${b}` : b), '');
  };

  chrome.storage.sync.get(optionIds, (options) => {
    // Update form with options got
    setForm(options);

    // Hit the reset button to revert form to previous settings
    formElements.reset.addEventListener('click', () => {
      // Or use defaults?
      setForm(options);

      // Show a brief message
      popMessage('Options reset, hit save to apply!');
    });

    // Click save to store the options, update the form if successful
    formElements.save.addEventListener('click', () => {
      const settings = getForm();

      chrome.storage.sync.set(settings, () => {
        // Success, let the form reflect the changed options
        setForm(settings);

        // Show a brief message
        popMessage('Options saved!');
      });
    });
  });
})(window, document);
