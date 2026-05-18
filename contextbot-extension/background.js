// ContextBot — background service worker
// Handles Backend API calls

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_ARTICLE') {
    analyzeArticle(message.payload).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true; // keep channel open for async response
  }
});

async function analyzeArticle({ text, url, token }) {
  const content = `URL: ${url || 'unknown'}\n\nArticle text:\n${text.slice(0, 4000)}`;

  const response = await fetch('http://localhost:5001/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('You have reached your 10 free analyses for the month.');
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${response.status}`);
  }

  const data = await response.json();
  return { result: data.analysis, usage: data.usage };
}
