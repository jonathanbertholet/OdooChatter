// Load saved states when popup opens
chrome.storage.sync.get(
  ['hideChatter', 'displayBelow', 'debugMode', 'stylishSupport'], 
  function(result) {
    document.getElementById('hideChatter').checked = result.hideChatter ?? false;
    document.getElementById('displayBelow').checked = result.displayBelow ?? false;
    document.getElementById('debugMode').checked = result.debugMode ?? false;
    document.getElementById('stylishSupportToggle').checked = result.stylishSupport ?? false;
});

// Save states when toggles change
document.getElementById('hideChatter').addEventListener('change', function(e) {
  chrome.storage.sync.set({
    hideChatter: e.target.checked
  });
});

document.getElementById('displayBelow').addEventListener('change', function(e) {
  chrome.storage.sync.set({
    displayBelow: e.target.checked
  });
});

document.getElementById('debugMode').addEventListener('change', function(e) {
  const enabled = e.target.checked;
  const toggle = e.target;
  
  // Disable the toggle while changes are applying
  toggle.disabled = true;
  
  chrome.storage.sync.set({
    debugMode: enabled
  });
  
  // Apply debug mode to all matching tabs
  chrome.tabs.query({url: "*://*.odoo.com/*"}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'updateDebugMode',
        enabled: enabled
      });
    });
    
    // Re-enable the toggle after a short delay
    setTimeout(() => {
      toggle.disabled = false;
    }, 1000);
  });
});

// Add this after your existing event listeners
document.getElementById('settingsLink').addEventListener('click', function() {
  // Query for the active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);
      // Simply append /odoo/settings?debug=1 to the base URL
      const settingsUrl = `${url.origin}/odoo/settings?debug=1`;
      // Navigate the current tab
      chrome.tabs.update(currentTab.id, {url: settingsUrl});
      // Close the popup
      window.close();
    }
  });
}); 

document.getElementById('stylishSupportToggle').addEventListener('change', function(e) {
  chrome.storage.sync.set({
    stylishSupport: e.target.checked
  });
});
