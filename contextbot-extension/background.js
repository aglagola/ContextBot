// ContextBot — background service worker
// Handles Anthropic API calls (keeps API key out of content scripts)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_ARTICLE') {
    analyzeArticle(message.payload).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true; // keep channel open for async response
  }
});

async function analyzeArticle({ text, url, apiKey }) {
  const prompt = `You are ContextBot, a media intelligence assistant. Analyze the following article and return a JSON object only — no markdown, no explanation, no preamble.

URL: ${url || 'unknown'}
Article text (first 4000 chars):
${text.slice(0, 4000)}

Return this exact JSON structure:
{
  "source": {
    "name": "Publication name (infer from URL domain or article text)",
    "ownership": "Who owns or funds it (1 sentence, be specific)",
    "bias": "left" | "left-center" | "center" | "right-center" | "right",
    "biasPosition": 0.5,
    "trustNotes": "1 sentence on credibility, notable history, or corrections record"
  },
  "claims": [
    {
      "text": "A specific factual claim from the article (keep it short)",
      "verdict": "supported" | "disputed" | "needs-context",
      "verdictNote": "Brief explanation of why"
    }
  ],
  "missingContext": [
    "A specific fact, counterargument, or background detail not mentioned in the article"
  ],
  "perspectives": [
    {
      "outlet": "Outlet name",
      "angle": "How they would likely frame this story differently (1 sentence)"
    }
  ]
}

Rules:
- biasPosition is a float: 0.0 = far left, 0.5 = center, 1.0 = far right
- Return 2-3 claims, 2-3 missingContext items, 2-3 perspectives
- Be specific and genuinely useful — avoid vague generalities
- Return only valid JSON, nothing else`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content.map(b => b.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return { result: JSON.parse(clean) };
  } catch {
    throw new Error('Failed to parse API response as JSON');
  }
}
