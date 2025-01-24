// ----------------------------------
// 0) Configuration constants
// ----------------------------------
const CONFIG = {
  DEBOUNCE_INTERVAL: 250,   // Delay for debouncing
  THROTTLE_INTERVAL: 150,   // Delay for throttling
  SUPPORT_NAVBAR_SCROLL_THRESHOLD: 20,  // Scroll threshold for support navbar
  RECENT_VIEWS_LIMIT: 35,   // Maximum number of recent views stored
  DEBUG_MODE_CHECK_INTERVAL: 10000, // Interval to check path changes for debug mode mismatch
};

// URL management
let lastUrl = window.location.href; // Save current URL

// ----------------------------------
// 1) Utility: Debounce function
// ----------------------------------
/**
 * Debounce a function to prevent it from being called too quickly in succession.
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ----------------------------------
// 2) Utility: Throttle function
// ----------------------------------
/**
 * Throttle a function to ensure it doesn't get called more often than the limit specifies.
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ----------------------------------
// 3) Feature: Recent Views
// ----------------------------------
/**
 * Tracks the most recent view if on a form view. Inserts new views at the start of the list
 * and removes duplicates, keeping only the most recent 50.
 */
function trackRecentView() {
  const formView = document.querySelector('.o_form_view');
  if (!formView) return; // Early return if not on a form view

  const title = document.title.split(' - ').slice(0, -1).join(' - ') || document.title;
  const url = window.location.href;

  // Get existing recent views from storage
  chrome.storage.local.get(['recentViews'], function(result) {
    let recentViews = result.recentViews || [];

    // Create new view entry
    const newView = {
      title,
      url,
      timestamp: Date.now()
    };

    // Remove duplicates
    recentViews = recentViews.filter(view => view.url !== url);

    // Add new view at the beginning
    recentViews.unshift(newView);

    // Keep only the last XX views
    recentViews = recentViews.slice(0, CONFIG.RECENT_VIEWS_LIMIT);

    // Save updated list
    chrome.storage.local.set({ recentViews });
  });
}

// ----------------------------------
// 4) Feature: Chatter Management
// ----------------------------------
/**
 * Checks if relevant page has the chatter container.
 * @returns {boolean} True if chatter is present, else false.
 */
function isRelevantPage() {
  return !!document.querySelector('.o-mail-ChatterContainer, .o_mail_chattercontainer');
}

/**
 * Initializes the chatter manager by creating or removing the toggle button based on the presence of chatter.
 */
function initChatterManager() {
  if (isRelevantPage()) {
    const chatterContainer = document.querySelector('.o-mail-ChatterContainer, .o_mail_chattercontainer');
    const formContainer = chatterContainer?.closest('.o_content > div');

    if (formContainer && chatterContainer) {
      insertToggleButton(formContainer, chatterContainer);
    }
  } else {
    removeToggleButton();
  }
}

/**
 * Creates the toggle button and inserts it into the form container if it doesn't already exist.
 * @param {HTMLElement} formContainer 
 * @param {HTMLElement} chatterContainer 
 */
function insertToggleButton(formContainer, chatterContainer) {
  const existingToggleButton = document.querySelector('.chatter-toggle');
  if (existingToggleButton) {
    console.log('Toggle button already exists. Skipping insertion.');
    return;
  }

  const toggleButton = createToggleButton();
  formContainer.insertBefore(toggleButton, chatterContainer);

  // Apply initial settings based on user preferences
  chrome.storage.sync.get(['hideChatter', 'displayBelow'], function(result) {
    const shouldDisplayBelow = result.displayBelow ?? false;
    const defaultHidden = result.hideChatter ?? false;

    // Show or hide the toggle button based on displayBelow
    toggleButton.style.display = !shouldDisplayBelow ? 'flex' : 'none';

    if (shouldDisplayBelow) {
      formContainer.classList.add('vertical-layout');
      chatterContainer.classList.remove('hidden');
      formContainer.classList.remove('centered-form');
    } else {
      formContainer.classList.remove('vertical-layout');
      if (defaultHidden) {
        chatterContainer.classList.add('hidden');
        formContainer.classList.add('centered-form');
        toggleButton.classList.remove('active');
      } else {
        chatterContainer.classList.remove('hidden');
        formContainer.classList.remove('centered-form');
        toggleButton.classList.add('active');
      }

      // Toggle chatter visibility on button click
      toggleButton.addEventListener('click', () => {
        const isHidden = chatterContainer.classList.toggle('hidden');
        formContainer.classList.toggle('centered-form');
        toggleButton.classList.toggle('active');
      });
    }
  });
}

/**
 * Creates and returns a styled toggle button element.
 * @returns {HTMLButtonElement}
 */
function createToggleButton() {
  const button = document.createElement('button');
  button.className = 'chatter-toggle side-mode';
  button.innerHTML = `
    <svg class="chatter-toggle-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M12 14L7 10L12 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  button.title = 'Toggle Chatter';
  return button;
}

/**
 * Removes the chatter toggle button from the DOM if it exists.
 */
function removeToggleButton() {
  const existingToggleButton = document.querySelector('.chatter-toggle');
  if (existingToggleButton) {
    existingToggleButton.remove();
    console.log('Toggle button removed.');
  }
}

/**
 * Handles changes to the 'displayBelow' setting.
 * @param {boolean} isBelow 
 * @param {HTMLElement} formContainer 
 * @param {HTMLElement} chatterContainer 
 * @param {HTMLElement} toggleButton 
 */
function handleDisplayBelowChange(isBelow, formContainer, chatterContainer, toggleButton) {
  if (isBelow) {
    formContainer.classList.add('vertical-layout');
    chatterContainer.classList.remove('hidden');
    formContainer.classList.remove('centered-form');
    toggleButton.style.display = 'none';
  } else {
    formContainer.classList.remove('vertical-layout');
    toggleButton.style.display = 'flex';
    const isHidden = chatterContainer.classList.contains('hidden');
    formContainer.classList.toggle('centered-form', isHidden);
    toggleButton.classList.toggle('active', !isHidden);
  }
}

/**
 * Handles changes to the 'hideChatter' setting.
 * @param {boolean} isHidden 
 * @param {HTMLElement} formContainer 
 * @param {HTMLElement} chatterContainer 
 * @param {HTMLElement} toggleButton 
 */
function handleHideChatterChange(isHidden, formContainer, chatterContainer, toggleButton) {
  if (isHidden) {
    chatterContainer.classList.add('hidden');
    formContainer.classList.add('centered-form');
    toggleButton.classList.remove('active');
  } else {
    chatterContainer.classList.remove('hidden');
    formContainer.classList.remove('centered-form');
    toggleButton.classList.add('active');
  }
}

// ----------------------------------
// 5) Feature: Debug Mode Management
// ----------------------------------
/**
 * Retrieves the current debug mode from the URL query string.
 * @returns {string} The value of the 'debug' query param, if any.
 */
function getDebugMode() {
  const url = new URL(window.location.href);
  return url.searchParams.get('debug') || '';
}

/**
 * Updates the debug mode parameter in the URL without reloading the page,
 * unless the actual debug state has changed.
 * @param {string} mode - '1' to enable debug mode, '' to disable it.
 */
function updateDebugMode(mode) {
  const url = new URL(window.location.href);
  const currentMode = url.searchParams.get('debug');

  if (currentMode !== mode) {
    if (mode) {
      url.searchParams.set('debug', mode);
    } else {
      url.searchParams.delete('debug');
    }
    window.history.replaceState({}, '', url.toString());
  }
}

/**
 * Determines if the URL is a "slide" URL.
 * @returns {boolean}
 */
function isSlideUrl() {
  return window.location.pathname.includes('/slides/') ||
         window.location.href.includes('odoo.com/help');
}

/**
 * Determines if the URL is a "support" page.
 * @returns {boolean}
 */
function isSupportPage() {
  return window.location.pathname.includes('/_odoo/support');
}

/**
 * Manages debug mode changes. Will reload if actually toggling the debug state.
 * @param {boolean} enabled 
 */
function handleDebugModeChange(enabled) {
  // Avoid toggling debug on slides pages
  if (isSlideUrl()) return;
  
  const currentMode = getDebugMode();
  const shouldBeEnabled = enabled && currentMode !== '1';
  const shouldBeDisabled = !enabled && currentMode === '1';

  if (shouldBeEnabled || shouldBeDisabled) {
    updateDebugMode(enabled ? '1' : '');
    window.location.reload();
  }
}

/**
 * Periodically checks the debug mode for consistency. Reloads if there's a mismatch between
 * stored debugMode in chrome.storage and the actual URL state.
 */
function checkDebugModeConsistency() {
  chrome.storage.sync.get(['debugMode'], function(result) {
    const shouldBeEnabled = result.debugMode ?? false;
    const currentMode = getDebugMode();
    // Only update if there's a mismatch
    if ((shouldBeEnabled && currentMode !== '1') ||
        (!shouldBeEnabled && currentMode === '1')) {
      handleDebugModeChange(shouldBeEnabled);
    }
  });
}

// Check debug mode consistency on page load
checkDebugModeConsistency();

// ----------------------------------
// 6) Setup: Interval check for path changes (debug mode consistency)
// ----------------------------------
let lastPathname = window.location.pathname;
setInterval(() => {
  const currentPathname = window.location.pathname;
  if (currentPathname !== lastPathname) {
    lastPathname = currentPathname;
    checkDebugModeConsistency();
  }
}, CONFIG.DEBUG_MODE_CHECK_INTERVAL);

// ----------------------------------
// 7) Feature: Support Page Styling & TOC
// ----------------------------------
/**
 * Adds or removes support page styling depending on user options.
 */
function handleSupportPageStyling() {
  if (!isSupportPage()) return;

  chrome.storage.sync.get(['stylishSupport'], function(result) {
    // Find or create our custom style element
    let styleElement = document.getElementById('custom-support-styles');
    if (!styleElement) {
      styleElement = document.createElement('link');
      styleElement.id = 'custom-support-styles';
      styleElement.rel = 'stylesheet';
      styleElement.type = 'text/css';
      styleElement.href = chrome.runtime.getURL('support.css');
    }

    if (result.stylishSupport) {
      // Add styles if not present
      if (!document.head.contains(styleElement)) {
        document.head.appendChild(styleElement);
      }
      createTableOfContents();
      handleNavbarScroll();
      moveImpersonationToNavbar(); // You mentioned this in your snippet, please ensure it's defined
    } else {
      // Remove styles if present
      if (document.head.contains(styleElement)) {
        styleElement.remove();
      }
      // Remove table of contents if styles are disabled
      const toc = document.querySelector('.toc-container');
      if (toc) toc.remove();
    }
  });
}

/**
 * Creates a table of contents for support pages. Smooth scroll behavior is added by clicking headings.
 */
function createTableOfContents() {
  if (!isSupportPage()) return;

  const existingToc = document.querySelector('.toc-container');
  if (existingToc) existingToc.remove();

  const headings = Array.from(document.querySelectorAll('h2'));
  if (headings.length === 0) return;

  const tocContainer = document.createElement('div');
  tocContainer.className = 'toc-container';

  const tocTitle = document.createElement('div');
  tocTitle.className = 'toc-title';
  tocTitle.textContent = 'Table of Contents';
  tocContainer.appendChild(tocTitle);

  const tocList = document.createElement('ul');
  tocList.className = 'toc-list';

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `section-${index}`;
    }

    const listItem = document.createElement('li');
    listItem.className = 'toc-item';

    const link = document.createElement('a');
    link.className = 'toc-link';
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;

    // Smooth scroll
    link.addEventListener('click', (e) => {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth' });
      updateActiveLink(link);
    });

    listItem.appendChild(link);
    tocList.appendChild(listItem);
  });

  tocContainer.appendChild(tocList);
  document.body.appendChild(tocContainer);

  addScrollSpy(headings);
}

/**
 * Updates the "active" link in the TOC.
 * @param {HTMLElement} activeLink 
 */
function updateActiveLink(activeLink) {
  document.querySelectorAll('.toc-link').forEach(link => {
    link.classList.remove('active');
  });
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

/**
 * Enables a scroll spy by observing headings using IntersectionObserver.
 * @param {HTMLElement[]} headings 
 */
function addScrollSpy(headings) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        const correspondingLink = document.querySelector(`.toc-link[href="#${id}"]`);
        updateActiveLink(correspondingLink);
      }
    });
  }, {
    rootMargin: '-20% 0px -80% 0px'
  });

  headings.forEach(heading => observer.observe(heading));
}

/**
 * Adds scrolled class to navbar when the user has scrolled beyond a certain threshold.
 */
function handleNavbarScroll() {
  if (!isSupportPage()) return;
  const navbar = document.getElementById('support-nav');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > CONFIG.SUPPORT_NAVBAR_SCROLL_THRESHOLD) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// ----------------------------------
// 8) Feature: Keyboard Shortcut Manager
// ----------------------------------
/**
 * Initializes a keyboard shortcut to toggle chatter. Mac uses Cmd+Shift+X;
 * Windows/Linux uses Alt+Shift+C.
 */
function initKeyboardShortcut() {
  document.addEventListener('keydown', function(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    // Command+Shift+X on Mac, Alt+Shift+C on Windows/Linux
    if ((isMac && e.metaKey && e.shiftKey && e.key.toLowerCase() === 'x') ||
        (!isMac && e.altKey && e.shiftKey && e.key.toLowerCase() === 'c')) {
      e.preventDefault();
      const toggleButton = document.querySelector('.chatter-toggle');
      if (toggleButton) {
        toggleButton.click();

        // Show a subtle feedback tooltip
        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(135, 90, 123, 0.9);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          z-index: 1001;
          font-size: 13px;
          pointer-events: none;
          transition: opacity 0.3s ease;
        `;
        tooltip.textContent = `Chatter toggled (${isMac ? '⌘⇧X' : 'Alt+Shift+C'})`;
        document.body.appendChild(tooltip);

        setTimeout(() => {
          tooltip.style.opacity = '0';
          setTimeout(() => tooltip.remove(), 300);
        }, 1000);
      }
    }
  });
}
initKeyboardShortcut(); // Initialize keyboard shortcuts

// ----------------------------------
// 9) Single Mutation Observer
// ----------------------------------
/**
 * Watches for DOM changes that may add or remove the chatter container or
 * otherwise require re-initialization or tracking changes.
 */
const chatterObserver = new MutationObserver(throttle((mutations) => {
  let chatterChanged = false;

  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      // For added nodes
      mutation.addedNodes.forEach(node => {
        if (
          node.nodeType === Node.ELEMENT_NODE && 
          (node.matches('.o-mail-ChatterContainer, .o_mail_chattercontainer') ||
           node.querySelector?.('.o-mail-ChatterContainer, .o_mail_chattercontainer'))
        ) {
          chatterChanged = true;
        }
      });

      // For removed nodes
      mutation.removedNodes.forEach(node => {
        if (
          node.nodeType === Node.ELEMENT_NODE && 
          (node.matches('.o-mail-ChatterContainer, .o_mail_chattercontainer') ||
           node.querySelector?.('.o-mail-ChatterContainer, .o_mail_chattercontainer'))
        ) {
          chatterChanged = true;
        }
      });
    }

    // If attributes relevant to chatter are changed
    if (mutation.type === 'attributes' && ['href', 'data-action'].includes(mutation.attributeName)) {
      chatterChanged = true;
    }
  });

  if (chatterChanged) {
    trackRecentView();
    debouncedInit();
  }
}, CONFIG.THROTTLE_INTERVAL));

// Start observing changes throughout the document
chatterObserver.observe(document, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['href', 'data-action'],
  characterData: false
});

// ----------------------------------
// 10) Clean-up observer on unload
// ----------------------------------
function disconnectObservers() {
  chatterObserver.disconnect();
}
window.addEventListener('unload', disconnectObservers);

// ----------------------------------
// 11) Debounced initialization function
// ----------------------------------
const debouncedInit = debounce(initChatterManager, CONFIG.DEBOUNCE_INTERVAL);
initChatterManager(); // Initial check when the script is first loaded

// ----------------------------------
// 12) Additional: Keep Default Chatter Size
// ----------------------------------
/**
 * Toggles a class on the HTML element to restore default Chatter size if requested.
 * @param {boolean} keepDefaultChatterSize 
 */
// function applyChatterSizePreference(keepDefaultChatterSize) {
//   // We apply the class to the <html> so it cascades over all .o-mail-ChatterContainer
//   if (keepDefaultChatterSize) {
//     document.documentElement.classList.add('keep-default-chatter-size');
//   } else {
//     document.documentElement.classList.remove('keep-default-chatter-size');
//   }
// }

// // Retrieve and apply keepDefaultChatterSize on load
// chrome.storage.sync.get(['keepDefaultChatterSize'], function(result) {
//   applyChatterSizePreference(result.keepDefaultChatterSize ?? false);
// });

// Listen for changes and re-apply as needed
chrome.storage.onChanged.addListener((changes) => {
  // Stylish support toggling
  if (changes.stylishSupport) {
    handleSupportPageStyling();
  }
  // Debug mode toggling 
  if (changes.debugMode) {
    handleDebugModeChange(changes.debugMode.newValue);
  }
  // Chatter size preference toggling
  if (changes.keepDefaultChatterSize) {
    // applyChatterSizePreference(changes.keepDefaultChatterSize.newValue);
  }
});

// Final call for applying support page styling if needed
if (isSupportPage()) {
  handleSupportPageStyling();
}
