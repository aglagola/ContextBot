// Listen for extraction requests from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "EXTRACT") {
    try {
      const title = document.title || "";
      const url = window.location.href || "";
      
      // Simple heuristic for article content extraction
      const paragraphs = Array.from(document.querySelectorAll("article p, main p, p"));
      const text = paragraphs
        .map(p => p.innerText.trim())
        .filter(t => t.length > 20) // Skip short layout snippets
        .slice(0, 15) // Limit context length to avoid heavy payloads
        .join("\n\n");

      sendResponse({ title, url, text });
    } catch (e) {
      sendResponse({ error: "Failed to extract article content: " + e.message });
    }
  }
});
