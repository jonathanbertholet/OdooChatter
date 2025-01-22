// Load saved states when popup opens
chrome.storage.sync.get(
  ['hideChatter', 'displayBelow', 'debugMode', 'stylishSupport'], 
  function(result) {
    const hideChatterElement = document.getElementById('hideChatter');
    hideChatterElement.checked = result.hideChatter ?? false;
    
    const displayBelowElement = document.getElementById('displayBelow');
    displayBelowElement.checked = result.displayBelow ?? false;
    
    // Disable hideChatter if displayBelow is enabled
    hideChatterElement.disabled = displayBelowElement.checked;
    
    document.getElementById('debugMode').checked = result.debugMode ?? false;
    document.getElementById('stylishSupportToggle').checked = result.stylishSupport ?? false;
});

// Update displayBelow event listener to manage hideChatter state
document.getElementById('displayBelow').addEventListener('change', function(e) {
  const hideChatterElement = document.getElementById('hideChatter');
  hideChatterElement.disabled = e.target.checked;
  
  // If enabling displayBelow, uncheck and save hideChatter as false
  if (e.target.checked) {
    hideChatterElement.checked = false;
    chrome.storage.sync.set({
      hideChatter: false,
      displayBelow: true
    });
  } else {
    // Only update displayBelow when turning it off
    chrome.storage.sync.set({
      displayBelow: false
    });
  }
});

// Add hideChatter event listener
document.getElementById('hideChatter').addEventListener('change', function(e) {
  chrome.storage.sync.set({
    hideChatter: e.target.checked
  });
});

document.getElementById('debugMode').addEventListener('change', function(e) {
  chrome.storage.sync.set({
    debugMode: e.target.checked
  });
});

document.getElementById('stylishSupportToggle').addEventListener('change', function(e) {
  chrome.storage.sync.set({
    stylishSupport: e.target.checked
  });
});

// Function to format timestamp
function formatTimestamp(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Load saved 'showDomains' state when popup opens
chrome.storage.local.get(['showDomains'], function(result) {
  // If there's no stored preference, default to true
  document.getElementById('showDomainsToggle').checked = result.showDomains ?? true;
});

// Listen for toggle changes to update local storage
document.getElementById('showDomainsToggle').addEventListener('change', function(e) {
  // Save the new 'showDomains' setting to local storage
  chrome.storage.local.set({ showDomains: e.target.checked }, function() {
    // Refresh the recent views list to immediately reflect the toggle
    displayRecentViews();
  });
});

// Function to display recent views
function displayRecentViews() {
  // Get the container where recent views will be displayed
  const recentViewsList = document.getElementById('recentViewsList');
  // If it doesn't exist, no need to proceed
  if (!recentViewsList) return;

  // Retrieve recent views and the showDomains setting from local storage
  chrome.storage.local.get(['recentViews', 'showDomains'], function(result) {
    // Read saved recentViews array or default to empty
    let recentViews = result.recentViews || [];
    // Determine if domains should be shown (default to true if undefined)
    const showDomains = result.showDomains ?? true;

    // Remove duplicate entries by URL
    recentViews = recentViews.filter((view, index, self) => 
      index === self.findIndex(v => v.url === view.url)
    );

    // If there are no recent views, display a placeholder message
    if (recentViews.length === 0) {
      recentViewsList.innerHTML = '<div class="recent-view-item" style="cursor: default; color: #666;">No recent views</div>';
      return;
    }

    // Build the HTML for the recent views list
    // We display the page title and timestamp on the same row, 
    // and place the domain name (if enabled) underneath.
    recentViewsList.innerHTML = recentViews
      .map(view => {
        // Extract domain name from URL
        const domain = new URL(view.url).hostname;
        // Return the HTML string for each recent view item
        return `
          <div class="recent-view-item" data-url="${view.url}" title="${view.title}">
            <!-- Container for the title and timestamp on the same line -->
            <div class="recent-view-header" style="display: flex; justify-content: space-between; align-items: center;">
              <!-- Display the page title -->
              <div class="recent-view-title">${view.title}</div>
              <!-- Display the timestamp to the right of the title -->
              <span class="recent-view-timestamp">${formatTimestamp(view.timestamp)}</span>
            </div>
            <!-- Display the domain below the title if showDomains is true -->
            ${
              showDomains 
                ? `<div class="recent-view-domain" style="font-size: 11px; color: #666;">${domain}</div>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    // Add click handlers for each item so clicking a recent view 
    // navigates to that URL in the current tab, then closes the popup
    recentViewsList.querySelectorAll('.recent-view-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.update(tabs[0].id, {url: url});
          window.close();
        });
      });
    });
  });
}

// Call displayRecentViews when popup opens
document.addEventListener('DOMContentLoaded', displayRecentViews);

// Listen for storage changes to update the list
chrome.storage.onChanged.addListener((changes) => {
  if (changes.recentViews) {
    displayRecentViews();
  }
});

// Settings link handler
document.getElementById('settingsLink').addEventListener('click', function() {
  // Query for the active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);
      // Append /odoo/settings?debug=1 to the base URL
      const settingsUrl = `${url.origin}/odoo/settings?debug=1`;
      // Navigate the current tab
      chrome.tabs.update(currentTab.id, {url: settingsUrl});
      // Close the popup
      window.close();
    }
  });
});
