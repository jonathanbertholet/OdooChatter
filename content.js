(function() {
  // Configuration constants
  const CONFIG = {
    DEBOUNCE_INTERVAL: 250,   // Delay for debouncing
    THROTTLE_INTERVAL: 150,   // Delay for throttling
    SUPPORT_NAVBAR_SCROLL_THRESHOLD: 20,  // Scroll threshold for support navbar
    RECENT_VIEWS_LIMIT: 50,   // Maximum number of recent views stored
    DEBUG_MODE_CHECK_INTERVAL: 10000, // Interval to check path changes for debug mode mismatch
  };

  // Utility: Debounce function
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

  // Utility: Throttle function
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

  // Utility: Chrome Storage Helpers (Promisified)
  /**
   * Gets a single setting from chrome storage.
   * @param {string} key - The storage key.
   * @param {('sync'|'local')} [area='sync'] - The chrome storage area.
   * @returns {Promise<any>}
   */
  function getSetting(key, area = 'sync') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(key, (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(result[key]);
      });
    });
  }

  /**
   * Gets multiple settings from chrome storage.
   * @param {string[]} keys - The storage keys.
   * @param {('sync'|'local')} [area='sync'] - The chrome storage area.
   * @returns {Promise<Object>}
   */
  function getSettings(keys, area = 'sync') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(keys, (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(result);
      });
    });
  }

  /**
   * Sets a single setting in chrome storage.
   * @param {string} key - The storage key.
   * @param {any} value - The value to set.
   * @param {('sync'|'local')} [area='sync'] - The chrome storage area.
   * @returns {Promise<void>}
   */
  function setSetting(key, value, area = 'sync') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  // Utility: Trigger resize event
  /**
   * Triggers a window resize event.
   */
  function triggerResize() {
    window.dispatchEvent(new Event('resize'));
  }

  // Feature: Recent Views
  /**
   * Tracks the most recent view if on a form view. Inserts new views at the start of the list
   * and removes duplicates, keeping only the most recent 50.
   */
  function trackRecentView() {
    const formView = document.querySelector('.o_form_view');
    if (!formView) return; // Early return if not on a form view

    const title = document.title.split(' - ').slice(0, -1).join(' - ') || document.title;
    const url = window.location.href;

    // Get existing recent views from storage using our helper for local storage
    getSetting('recentViews', 'local').then(recentViews => {
      recentViews = recentViews || [];

      // Create new view entry
      const newView = {
        title,
        url,
        timestamp: Date.now()
      };

      // Remove duplicates
      recentViews = recentViews.filter(view => view.url !== url);

      // Add new view at the beginning and limit the list
      recentViews.unshift(newView);
      recentViews = recentViews.slice(0, CONFIG.RECENT_VIEWS_LIMIT);

      // Save updated list
      setSetting('recentViews', recentViews, 'local').catch(console.error);
    }).catch(console.error);
  }

  // Feature: Chatter Management
  /**
   * Chatter Manager object to handle all chatter related functionalities.
   */
  const chatterManager = {
    /**
     * Checks if the page is relevant by ensuring the chatter container exists.
     * @returns {boolean}
     */
    isRelevantPage: function() {
      return !!this.getChatterContainer();
    },

    /**
     * Retrieves the chatter container element.
     * @returns {HTMLElement|null}
     */
    getChatterContainer: function() {
      return document.querySelector('.o-mail-ChatterContainer, .o_mail_chattercontainer');
    },

    /**
     * Creates and returns a styled toggle button element.
     * @returns {HTMLButtonElement}
     */
    createToggleButton: function() {
      // Create toggle button element with SVG icon
      const button = document.createElement('button');
      button.className = 'chatter-toggle side-mode';
      button.innerHTML = `
        <svg class="chatter-toggle-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <path d="M12 14L7 10L12 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      button.title = 'Toggle Chatter';
      return button;
    },

    /**
     * Inserts the toggle button into the form container, setting it up based on user preferences.
     * @param {HTMLElement} formContainer 
     * @param {HTMLElement} chatterContainer 
     */
    insertToggleButton: function(formContainer, chatterContainer) {
      const existingToggleButton = document.querySelector('.chatter-toggle');
      if (existingToggleButton) {
        console.log('Toggle button already exists. Skipping insertion.');
        return;
      }

      const toggleButton = this.createToggleButton();
      formContainer.insertBefore(toggleButton, chatterContainer);

      // Retrieve settings for chatter display preferences
      getSettings(['hideChatter', 'displayBelow']).then(settings => {
        const shouldDisplayBelow = settings.displayBelow ?? false;
        const defaultHidden = settings.hideChatter ?? false;

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

          // Bind click event to toggle chatter visibility
          toggleButton.addEventListener('click', () => {
            const isHidden = chatterContainer.classList.toggle('hidden');
            formContainer.classList.toggle('centered-form');
            toggleButton.classList.toggle('active');
            // Trigger resize event to adjust layout
            triggerResize();
          });
        }
      }).catch(console.error);
    },

    /**
     * Removes the chatter toggle button from the DOM if it exists.
     */
    removeToggleButton: function() {
      const existingToggleButton = document.querySelector('.chatter-toggle');
      if (existingToggleButton) {
        existingToggleButton.remove();
        console.log('Toggle button removed.');
      }
    },

    /**
     * Initializes the chatter manager by inserting or removing the toggle button based on the page.
     */
    init: function() {
      if (this.isRelevantPage()) {
        const chatterContainer = this.getChatterContainer();
        const formContainer = chatterContainer?.closest('.o_content > div');
        if (formContainer && chatterContainer) {
          this.insertToggleButton(formContainer, chatterContainer);
        }
      } else {
        this.removeToggleButton();
      }
    },

    /**
     * Applies the selected chatter width by updating its CSS classes.
     * @param {string} width - The selected width ('standard', 'medium', 'large').
     */
    applyWidth: function(width) {
      const chatterContainer = this.getChatterContainer();
      if (!chatterContainer) return;
      // Remove any existing width classes
      chatterContainer.classList.remove('standard', 'medium', 'large');

      // Add new width class if valid; fallback to 'standard'
      if (['standard', 'medium', 'large'].includes(width)) {
        chatterContainer.classList.add(width);
      } else {
        chatterContainer.classList.add('standard');
      }
    },

    /**
     * Initializes chatter width based on stored settings.
     */
    initWidth: function() {
      getSetting('chatterWidth').then(width => {
        this.applyWidth(width || 'standard');
      }).catch(console.error);
    },

    /**
     * Handles changes to the 'displayBelow' setting.
     * @param {boolean} isBelow 
     * @param {HTMLElement} formContainer 
     * @param {HTMLElement} chatterContainer 
     * @param {HTMLElement} toggleButton 
     */
    handleDisplayBelowChange: function(isBelow, formContainer, chatterContainer, toggleButton) {
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
    },

    /**
     * Handles changes to the 'hideChatter' setting.
     * @param {boolean} isHidden 
     * @param {HTMLElement} formContainer 
     * @param {HTMLElement} chatterContainer 
     * @param {HTMLElement} toggleButton 
     */
    handleHideChatterChange: function(isHidden, formContainer, chatterContainer, toggleButton) {
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
  };

  // Feature: Debug Mode Management
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
   * Determines if the URL is a "non-debug compatible" URL.
   * @returns {boolean}
   */
  function isSlideUrl() {
    return window.location.pathname.includes('/slides/') ||
           window.location.href.includes('odoo.com/help') ||
           window.location.pathname.includes('/odoo/website/');
  }

  /**
   * Determines if the URL is a "support" page.
   * @returns {boolean}
   */
  function isSupportPage() {
    return window.location.pathname.includes('/_odoo/support');
  }

  /**
   * Manages debug mode changes.
   * @param {boolean} enabled 
   */
  function handleDebugModeChange(enabled) {
    if (isSlideUrl()) return;
    const currentMode = getDebugMode();

    if (enabled) {
      if (currentMode !== '1') {
        updateDebugMode('1');
        window.location.reload();
      }
    } else {
      if (currentMode === '1') {
        updateDebugMode('');
        window.location.reload();
      }
    }
  }

  // Feature: Support Page Styling & TOC
  /**
   * Adds or removes support page styling depending on user options.
   */
  function handleSupportPageStyling() {
    if (!isSupportPage()) return;

    getSetting('stylishSupport').then(stylishSupport => {
      let styleElement = document.getElementById('custom-support-styles');
      if (!styleElement) {
        styleElement = document.createElement('link');
        styleElement.id = 'custom-support-styles';
        styleElement.rel = 'stylesheet';
        styleElement.type = 'text/css';
        styleElement.href = chrome.runtime.getURL('support.css');
      }

      if (stylishSupport) {
        if (!document.head.contains(styleElement)) {
          document.head.appendChild(styleElement);
        }
        createTableOfContents();
        handleNavbarScroll();
        moveImpersonationToNavbar(); // Ensure this function is defined
      } else {
        if (document.head.contains(styleElement)) {
          styleElement.remove();
        }
        const toc = document.querySelector('.toc-container');
        if (toc) toc.remove();
      }
    }).catch(console.error);
  }

  /**
   * Creates a table of contents for support pages with smooth scroll behavior.
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

      // Smooth scroll behavior for TOC links
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
   * Updates the active link in the TOC.
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
   * Enables a scroll spy to highlight TOC items as content scrolls.
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
   * Adds or removes 'scrolled' class from the navbar based on scroll position.
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

  // Feature: Keyboard Shortcut Manager (Shortened Version)
  const initKeyboardShortcut = () => {
    document.addEventListener('keydown', e => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if (
        (isMac && e.metaKey && e.shiftKey && e.key.toLowerCase() === 'x') ||
        (!isMac && e.altKey && e.shiftKey && e.key.toLowerCase() === 'c')
      ) {
        e.preventDefault();
        const toggleButton = document.querySelector('.chatter-toggle');
        if (toggleButton) {
          toggleButton.click();
          // Temporary tooltip to indicate action
          const tooltip = document.createElement('div');
          tooltip.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(135,90,123,0.9);color:#fff;padding:8px 16px;border-radius:4px;z-index:1001;font-size:13px;pointer-events:none;transition:opacity .3s';
          tooltip.textContent = `Chatter toggled (${isMac ? '⌘⇧X' : 'Alt+Shift+C'})`;
          document.body.appendChild(tooltip);
          setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.remove(), 300);
          }, 1000);
        }
      }
    });
  };
  initKeyboardShortcut(); // Initialize keyboard shortcuts

  //  Feature: Dynamic Chatter Width Management
  // (Chatter width management is now part of chatterManager via initWidth and applyWidth)

  // Listen for changes in chatterWidth to dynamically apply them
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.chatterWidth) {
      getSetting('chatterWidth').then(width => {
        chatterManager.applyWidth(width || 'standard');
      }).catch(console.error);
    }
  });

  // Initialize chatter width on script load
  chatterManager.initWidth();

  // Single Mutation Observer for DOM changes
  const chatterObserver = new MutationObserver(throttle((mutations) => {
    let chatterChanged = false;

    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (
            node.nodeType === Node.ELEMENT_NODE && 
            (node.matches('.o-mail-ChatterContainer, .o_mail_chattercontainer') ||
             node.querySelector?.('.o-mail-ChatterContainer, .o_mail_chattercontainer'))
          ) {
            chatterChanged = true;
          }
        });

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

      if (mutation.type === 'attributes' && ['href', 'data-action'].includes(mutation.attributeName)) {
        chatterChanged = true;
      }
    });

    if (chatterChanged) {
      trackRecentView();
      debouncedInit();

      // Apply chatter width when chatter container changes
      getSetting('chatterWidth').then(width => {
        chatterManager.applyWidth(width || 'standard');
      }).catch(console.error);

      setTimeout(() => {
        triggerResize();
      }, 100);
    }
  }, CONFIG.THROTTLE_INTERVAL));

  // Start observing DOM changes
  chatterObserver.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href', 'data-action'],
    characterData: false
  });

  // Clean-up observer on unload
  function disconnectObservers() {
    chatterObserver.disconnect();
  }
  window.addEventListener('unload', disconnectObservers);

  // Debounced initialization function for Chatter Manager
  const debouncedInit = debounce(() => chatterManager.init(), CONFIG.DEBOUNCE_INTERVAL);

  // Replace immediate call with DOMContentLoaded handler for proper initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      chatterManager.init();
      setTimeout(() => {
        triggerResize();
      }, 500);
    });
  } else {
    chatterManager.init();
    setTimeout(() => {
      triggerResize();
    }, 500);
  }

  // Listen for storage changes to update support page styling and debug mode
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.stylishSupport) {
      handleSupportPageStyling();
    }
    if (changes.debugMode) {
      handleDebugModeChange(changes.debugMode.newValue);
    }
  });

  // Apply support page styling on load if on support page
  if (isSupportPage()) {
    handleSupportPageStyling();
  }
})();
