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

// Function to display recent views
function displayRecentViews() {
  const recentViewsList = document.getElementById('recentViewsList');
  if (!recentViewsList) return;

  chrome.storage.local.get(['recentViews'], function(result) {
    const recentViews = result.recentViews || [];
    
    if (recentViews.length === 0) {
      recentViewsList.innerHTML = '<div class="recent-view-item" style="cursor: default; color: #666;">No recent views</div>';
      return;
    }
    
    recentViewsList.innerHTML = recentViews
      .map(view => `
        <div class="recent-view-item" data-url="${view.url}" title="${view.title}">
          ${view.title} <span style="color: #666; margin-left: 4px; font-size: 10px">${formatTimestamp(view.timestamp)}</span>
        </div>
      `)
      .join('');
    
    // Add click handlers
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
