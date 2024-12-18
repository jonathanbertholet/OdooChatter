// URL management
let lastUrl = window.location.href;  // save current URL

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
    
    // Keep only last 50 views instead of 20
    recentViews = recentViews.slice(0, 50);
    
    // Save updated list
    chrome.storage.local.set({ recentViews: recentViews });
  });
}

// Debounce function to prevent rapid re-initialization
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
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

// Main function to initialize the chatter manager
function initChatterManager() {
  // Check if we already have an initialized toggle
  if (document.querySelector('.chatter-toggle')) {
    return;
  }

  // Find the chatter container
  const chatterContainer = document.querySelector('.o-mail-ChatterContainer');
  
  if (chatterContainer) {
    // Find the parent container that needs centering
    const formContainer = chatterContainer.closest('.o_content > div');
    
    if (formContainer) {
      // Create toggle container but don't append it yet
      const toggleContainer = createToggleContainer();
      
      chrome.storage.sync.get(
        ['hideChatter', 'displayBelow'], 
        function(result) {
          const shouldDisplayBelow = result.displayBelow ?? false;
          // This preference only controls initial state on page load
          const initiallyHidden = result.hideChatter ?? false;
          
          // Create button with correct initial position
          const toggleButton = createToggleButton();
          
          // Show/hide the button based on setting and position
          toggleButton.style.display = !shouldDisplayBelow ? 'flex' : 'none';
          
          // Function to update toggle button position
          const updateTogglePosition = (isBelow) => {
            toggleButton.remove();
            
            if (!isBelow) {
              document.body.appendChild(toggleButton);
              toggleButton.style.display = 'flex';
            }
          };
          
          // Initial position setup
          updateTogglePosition(shouldDisplayBelow);
          
          if (shouldDisplayBelow) {
            // In below mode, always show chatter
            formContainer.classList.add('vertical-layout');
            chatterContainer.classList.remove('hidden');
            formContainer.classList.remove('centered-form');
          } else {
            // In side mode, use initial preference for first load only
            formContainer.classList.remove('vertical-layout');
            if (initiallyHidden) {
              chatterContainer.classList.add('hidden');
              formContainer.classList.add('centered-form');
              toggleButton.classList.remove('active');
            } else {
              chatterContainer.classList.remove('hidden');
              formContainer.classList.remove('centered-form');
              toggleButton.classList.add('active');
            }

            // Add click event listener that only affects UI, doesn't update storage
            toggleButton.addEventListener('click', () => {
              const isHidden = chatterContainer.classList.toggle('hidden');
              formContainer.classList.toggle('centered-form');
              toggleButton.classList.toggle('active');
              // Removed the storage.sync.set call here
            });
          }
          
          // Modify the storage change listener
          chrome.storage.onChanged.addListener((changes) => {
            if (changes.displayBelow) {
              const isBelow = changes.displayBelow.newValue;
              if (isBelow) {
                formContainer.classList.add('vertical-layout');
                chatterContainer.classList.remove('hidden');
                formContainer.classList.remove('centered-form');
                updateTogglePosition(true);
              } else {
                formContainer.classList.remove('vertical-layout');
                updateTogglePosition(false);
                // Restore hidden state when switching back to side mode
                const currentHidden = chatterContainer.classList.contains('hidden');
                if (currentHidden) {
                  formContainer.classList.add('centered-form');
                  toggleButton.classList.remove('active');
                } else {
                  toggleButton.classList.add('active');
                }
              }
            }
            if (changes.hideChatter) {
              if (changes.hideChatter.newValue) {
                chatterContainer.classList.add('hidden');
                formContainer.classList.add('centered-form');
                toggleButton.classList.remove('active');
              } else {
                chatterContainer.classList.remove('hidden');
                formContainer.classList.remove('centered-form');
                toggleButton.classList.add('active');
              }
            }
            if (changes.debugMode) {
              handleDebugModeChange(changes.debugMode.newValue);
            }
          });
        });
    }
  }
}

// Function to check if we're on a relevant page
function isRelevantPage() {
  return !!document.querySelector('.o-mail-ChatterContainer');
}

// Debounced initialization function
const debouncedInit = debounce(() => {
  const existingButton = document.querySelector('.chatter-toggle');
  if (existingButton) {
    existingButton.remove();
  }
  if (isRelevantPage()) {
    initChatterManager();
  }
}, 250);

// Add throttle utility 
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Combined observer for url and chatter changes
const combinedObserver = new MutationObserver(throttle((mutations) => {
  try {
    // Track if we need updates
    let needsUrlCheck = false;
    let needsChatterCheck = false;
    
    for (const mutation of mutations) {
      // Quick checks to determine type of update needed
      if (mutation.target.nodeName === 'TITLE' || 
          (mutation.type === 'attributes' && ['href', 'data-action'].includes(mutation.attributeName))) {
        needsUrlCheck = true;
      }
      
      if (!needsChatterCheck && mutation.type === 'childList') {
        // Use more efficient checks for chatter-related changes
        needsChatterCheck = Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && (
            node.matches?.('.o-mail-ChatterContainer') ||
            node.querySelector?.('.o-mail-ChatterContainer')
          )
        );
      }
      
      // Break early if we need both updates
      if (needsUrlCheck && needsChatterCheck) break;
    }

    // Batch updates together
    if (needsUrlCheck) {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        debouncedInit();
        initDebugMode();
        handleSupportPageStyling();
        trackRecentView();
      }
    }
    if (needsChatterCheck) {
      debouncedInit();
    }
  } catch (error) {
    console.error('Error in mutation observer:', error);
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

// cleanup on page unload
window.addEventListener('unload', disconnectObservers);

// Initial check
if (isRelevantPage()) {
  initChatterManager();
}

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
    
    // Just update URL without reloading
    window.history.replaceState({}, '', url.toString());
  }
}

// Add this helper function
function isSlideUrl() {
  return window.location.pathname.includes('/slides/');
}

// Update the handleDebugModeChange function
function handleDebugModeChange(enabled) {
  // Don't modify debug mode on slides pages
  if (isSlideUrl()) {
    return;
  }

  const currentMode = getDebugMode();
  
  if (enabled) {
    // If debug is not already enabled, set it to '1' and reload
    if (!currentMode) {
      updateDebugMode('1');
      // Force page reload
      window.location.reload();
    }
  } else {
    // Remove debug mode if it's enabled and reload
    if (currentMode) {
      updateDebugMode('');
      // Force page reload
      window.location.reload();
    }
  }
}

// Update the initDebugMode function
function initDebugMode() {
  // Skip debug mode initialization for slides pages
  if (isSlideUrl()) {
    return;
  }

  chrome.storage.sync.get(['debugMode'], function(result) {
    if (result.debugMode) {
      handleDebugModeChange(true);
    }
  });
}

// Call initDebugMode on initial load
initDebugMode(); 

// support page detection
function isSupportPage() {
  return window.location.pathname.includes('/_odoo/support');
}

// support page styling
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
    
    // Command+Shift+X for Mac, Alt+C for others
    if ((isMac && e.metaKey && e.shiftKey && e.key.toLowerCase() === 'x') || 
        (!isMac && e.altKey && e.key.toLowerCase() === 'c')) {
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
        `;
        // Adjust tooltip text based on OS
        tooltip.textContent = `Chatter toggled (${isMac ? '⌘⇧X' : 'Alt+C'})`;
        document.body.appendChild(tooltip);
        
        // Remove tooltip after animation
        setTimeout(() => {
          tooltip.style.transition = 'opacity 0.3s ease';
          tooltip.style.opacity = '0';
          setTimeout(() => tooltip.remove(), 300);
        }, 1000);
      }
    }
  });
}

// Keyboard shortcuts 
initKeyboardShortcut(); 
