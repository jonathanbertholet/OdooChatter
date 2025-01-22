// URL management
let lastUrl = window.location.href;  // Save current URL

// Function to save recent views
function trackRecentView() {
  // Only save if we're on a form view
  const formView = document.querySelector('.o_form_view');
  if (!formView) return;

  // Get the view title
  const title = document.title.split(' - ').slice(0, -1).join(' - ') || document.title;
  const url = window.location.href;

  // Get existing recent views
  chrome.storage.local.get(['recentViews'], function(result) {
    let recentViews = result.recentViews || [];
    
    // Create new view entry
    const newView = {
      title: title,
      url: url,
      timestamp: Date.now()
    };
    
    // Remove duplicate if exists
    recentViews = recentViews.filter(view => view.url !== url);
    
    // Add new view at the beginning
    recentViews.unshift(newView);
    
    // Keep only last 50 views
    recentViews = recentViews.slice(0, 50);
    
    // Save updated list
    chrome.storage.local.set({ recentViews: recentViews });
  });
}

// Debounce function to prevent rapid re-initialization
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function to limit the rate of function execution
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

// Function to create the toggle button container
function createToggleContainer() {
  const container = document.createElement('div');
  container.className = 'chatter-toggle-container';
  container.style.display = 'flex';
  return container;
}

// Function to create the toggle button
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
 * Checks if the current page has the chatter container.
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
    // Chatter is present; ensure the toggle button is inserted
    const chatterContainer = document.querySelector('.o-mail-ChatterContainer, .o_mail_chattercontainer');
    const formContainer = chatterContainer?.closest('.o_content > div');

    if (formContainer && chatterContainer) {
      insertToggleButton(formContainer, chatterContainer);
    }
  } else {
    // Chatter is absent; remove the toggle button if it exists
    removeToggleButton();
  }
}

/**
 * Inserts the toggle button into the DOM.
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

    // Show or hide the toggle button based on settings
    toggleButton.style.display = !shouldDisplayBelow ? 'flex' : 'none';

    if (shouldDisplayBelow) {
      formContainer.classList.add('vertical-layout');
      chatterContainer.classList.remove('hidden');
      formContainer.classList.remove('centered-form');
    } else {
      formContainer.classList.remove('vertical-layout');
      // Set initial state based on default setting
      if (defaultHidden) {
        chatterContainer.classList.add('hidden');
        formContainer.classList.add('centered-form');
        toggleButton.classList.remove('active');
      } else {
        chatterContainer.classList.remove('hidden');
        formContainer.classList.remove('centered-form');
        toggleButton.classList.add('active');
      }

      // Add click event listener to toggle chatter visibility
      // But don't update storage - only manage current state
      toggleButton.addEventListener('click', () => {
        const isHidden = chatterContainer.classList.toggle('hidden');
        formContainer.classList.toggle('centered-form');
        toggleButton.classList.toggle('active');
      });
    }
  });
}

/**
 * Removes the toggle button from the DOM.
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
 * @param {boolean} isBelow - Whether to display the chatter below the form.
 * @param {Element} formContainer - The form container element.
 * @param {Element} chatterContainer - The chatter container element.
 * @param {Element} toggleButton - The toggle button element.
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
 * @param {boolean} isHidden - Whether the chatter should be hidden.
 * @param {Element} formContainer - The form container element.
 * @param {Element} chatterContainer - The chatter container element.
 * @param {Element} toggleButton - The toggle button element.
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

// Improved debug mode handling
function handleDebugModeChange(enabled) {
  // Don't modify debug mode on slides pages
  if (isSlideUrl()) {
    return;
  }

  const currentMode = getDebugMode();
  const shouldBeEnabled = enabled && currentMode !== '1';
  const shouldBeDisabled = !enabled && currentMode === '1';

  if (shouldBeEnabled || shouldBeDisabled) {
    updateDebugMode(enabled ? '1' : '');
    window.location.reload();
  }
}

// Add periodic check for debug mode consistency
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

// Add URL change detection for debug mode consistency
let lastPathname = window.location.pathname;
setInterval(() => {
  const currentPathname = window.location.pathname;
  if (currentPathname !== lastPathname) {
    lastPathname = currentPathname;
    checkDebugModeConsistency();
  }
}, 1000);

// Check debug mode consistency on page load
checkDebugModeConsistency();

// Debounced initialization function
const debouncedInit = debounce(initChatterManager, 250);

// Combined observer for URL and chatter changes
const combinedObserver = new MutationObserver(throttle((mutations) => {
  let chatterAddedOrRemoved = false;

  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches('.o-mail-ChatterContainer, .o-mail-ChatterContainer *')) {
          chatterAddedOrRemoved = true;
        }
      });

      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches('.o-mail-ChatterContainer, .o-mail-ChatterContainer *')) {
          chatterAddedOrRemoved = true;
        }
      });
    }

    if (mutation.type === 'attributes' && ['href', 'data-action'].includes(mutation.attributeName)) {
      chatterAddedOrRemoved = true;
    }
  });

  if (chatterAddedOrRemoved) {
    debouncedInit();
    trackRecentView();
  }
}, 150));

// Single observer configuration
combinedObserver.observe(document, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['href', 'data-action'],
  characterData: false
});

// Update cleanup function
function disconnectObservers() {
  combinedObserver.disconnect();
}

// Cleanup on page unload
window.addEventListener('unload', disconnectObservers);

// Initial check when the content script is loaded
initChatterManager();

// Debug Mode Functions
function getDebugMode() {
  const url = new URL(window.location.href);
  return url.searchParams.get('debug') || '';
}

function updateDebugMode(mode) {
  const url = new URL(window.location.href);
  const currentMode = url.searchParams.get('debug');

  // Only proceed if we're actually changing the mode
  if (currentMode !== mode) {
    if (mode) {
      url.searchParams.set('debug', mode);
    } else {
      url.searchParams.delete('debug');
    }

    // Update URL without reloading
    window.history.replaceState({}, '', url.toString());
  }
}

// Slide URL and Help page detection
function isSlideUrl() {
  return window.location.pathname.includes('/slides/') || 
         window.location.href.includes('odoo.com/help');
}

// Support page detection
function isSupportPage() {
  return window.location.pathname.includes('/_odoo/support');
}

// Support page styling
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
      // Add our custom styles if not already present
      if (!document.head.contains(styleElement)) {
        document.head.appendChild(styleElement);
      }
      // Create table of contents when styles are enabled
      createTableOfContents();
      handleNavbarScroll();
      moveImpersonationToNavbar();
    } else {
      // Remove our custom styles if present
      if (document.head.contains(styleElement)) {
        styleElement.remove();
      }
      // Remove table of contents when styles are disabled
      const toc = document.querySelector('.toc-container');
      if (toc) toc.remove();
    }
  });
}

// Add listener for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.stylishSupport) {
    handleSupportPageStyling();
  }
  // Add debug mode handling
  if (changes.debugMode) {
    handleDebugModeChange(changes.debugMode.newValue);
  }
});

// Initial check for support page
if (isSupportPage()) {
  handleSupportPageStyling();
}

function createTableOfContents() {
  // Only proceed if we're on a support page
  if (!isSupportPage()) return;

  // Remove existing TOC if present
  const existingToc = document.querySelector('.toc-container');
  if (existingToc) existingToc.remove();

  // Get all h2 headings
  const headings = Array.from(document.querySelectorAll('h2'));
  if (headings.length === 0) return;

  // Create TOC container
  const tocContainer = document.createElement('div');
  tocContainer.className = 'toc-container';

  // Add title
  const tocTitle = document.createElement('div');
  tocTitle.className = 'toc-title';
  tocTitle.textContent = 'Table of Contents';
  tocContainer.appendChild(tocTitle);

  // Create list
  const tocList = document.createElement('ul');
  tocList.className = 'toc-list';

  // Add entries for each heading
  headings.forEach((heading, index) => {
    // Add ID to heading if it doesn't have one
    if (!heading.id) {
      heading.id = `section-${index}`;
    }

    const listItem = document.createElement('li');
    listItem.className = 'toc-item';

    const link = document.createElement('a');
    link.className = 'toc-link';
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;

    // Add smooth scroll behavior
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

  // Add scroll spy functionality
  addScrollSpy(headings);
}

function updateActiveLink(activeLink) {
  // Remove active class from all links
  document.querySelectorAll('.toc-link').forEach(link => {
    link.classList.remove('active');
  });

  // Add active class to current link
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

function addScrollSpy(headings) {
  // Create IntersectionObserver
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

  // Observe all headings
  headings.forEach(heading => observer.observe(heading));
}

// Support page navbar scroll
function handleNavbarScroll() {
  if (!isSupportPage()) return;

  const navbar = document.getElementById('support-nav');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// Keyboard shortcuts manager
function initKeyboardShortcut() {
  document.addEventListener('keydown', function(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    // Command+Shift+X for Mac, Alt+Shift+C for Windows/Linux
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
        // Adjust tooltip text based on OS
        tooltip.textContent = `Chatter toggled (${isMac ? '⌘⇧X' : 'Alt+Shift+C'})`;
        document.body.appendChild(tooltip);

        // Remove tooltip after animation
        setTimeout(() => {
          tooltip.style.opacity = '0';
          setTimeout(() => tooltip.remove(), 300);
        }, 1000);
      }
    }
  });
}

// Initialize keyboard shortcuts 
initKeyboardShortcut(); 

// MutationObserver to watch for dynamic content changes
const observer = new MutationObserver(throttle((mutations) => {
  let shouldReinitialize = false;

  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches('.o-mail-ChatterContainer, .o_mail_chattercontainer') || node.querySelector('.o-mail-ChatterContainer, .o_mail_chattercontainer')) {
            shouldReinitialize = true;
          }
        }
      });

      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches('.o-mail-ChatterContainer, .o_mail_chattercontainer') || node.querySelector('.o-mail-ChatterContainer, .o_mail_chattercontainer')) {
            shouldReinitialize = true;
          }
        }
      });
    }
  });

  if (shouldReinitialize) {
    initChatterManager();
  }
}, 500)); // Adjust the throttle delay as needed

// Start observing the document body for mutations
observer.observe(document.body, { childList: true, subtree: true });

