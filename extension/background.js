// Open the side panel when the user clicks the extension action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for messages from content.js or sidebar.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("ContextBot background received message:", message);
  
  if (message.action === "GET_ARTICLE_CONTENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "EXTRACT" }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: "Cannot access this page. Try refreshing or copying text manually." });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ error: "No active tab found" });
      }
    });
    return true; // Keep channel open for async response
  }
});
