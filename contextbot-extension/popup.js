// ContextBot — popup.js

const views = {
  idle: document.getElementById('view-idle'),
  settings: document.getElementById('view-settings'),
  loading: document.getElementById('view-loading'),
  results: document.getElementById('view-results'),
};

function showView(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('active', k === name));
}

// --- Settings toggle ---
const toggleBtn = document.getElementById('toggle-settings');
let settingsOpen = false;

toggleBtn.addEventListener('click', () => {
  settingsOpen = !settingsOpen;
  if (settingsOpen) {
    showView('settings');
    chrome.storage.local.get('apiKey', ({ apiKey }) => {
      if (apiKey) document.getElementById('api-key-input').value = apiKey;
    });
  } else {
    checkKeyAndShowIdle();
  }
});

document.getElementById('save-key-btn').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;
  chrome.storage.local.set({ apiKey: key }, () => {
    settingsOpen = false;
    checkKeyAndShowIdle();
  });
});

function checkKeyAndShowIdle() {
  chrome.storage.local.get('apiKey', ({ apiKey }) => {
    const banner = document.getElementById('no-key-banner');
    banner.style.display = apiKey ? 'none' : 'block';
    document.getElementById('analyze-btn').disabled = !apiKey;
    showView('idle');
  });
}

// --- Analyze button ---
const loadingMessages = [
  'Reading the article...',
  'Checking the source...',
  'Scanning key claims...',
  'Finding missing context...',
  'Gathering perspectives...',
];

document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
document.getElementById('reanalyze-btn').addEventListener('click', runAnalysis);

async function runAnalysis() {
  showView('loading');
  const msgEl = document.getElementById('loading-msg');
  let msgIdx = 0;
  msgEl.textContent = loadingMessages[0];
  const interval = setInterval(() => {
    msgIdx = (msgIdx + 1) % loadingMessages.length;
    msgEl.textContent = loadingMessages[msgIdx];
  }, 1800);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Extract article text via content script
    let articleData;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFromPage,
      });
      articleData = results[0].result;
    } catch {
      // Fallback: send message to content script
      articleData = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });
    }

    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) throw new Error('No API key set. Please add your key in settings.');

    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_ARTICLE',
      payload: { text: articleData.text, url: articleData.url, apiKey }
    });

    clearInterval(interval);

    if (response.error) throw new Error(response.error);
    renderResults(response.result);
    showView('results');
  } catch (err) {
    clearInterval(interval);
    showView('results');
    const box = document.getElementById('error-box');
    box.textContent = err.message || 'Something went wrong. Please try again.';
    box.style.display = 'block';
    // Hide result sections on error
    ['sec-source', 'sec-claims'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
  }
}

// Injected directly into page context to extract text
function extractFromPage() {
  const selectors = [
    'article', '[role="article"]', '.article-body', '.article-content',
    '.story-body', '.post-content', '.entry-content', '.content-body',
    'main article', '#article-body', '.ArticleBody', '.article__body',
  ];
  let el = null;
  for (const s of selectors) { el = document.querySelector(s); if (el) break; }
  const container = el || document.querySelector('main') || document.body;
  const paras = container.querySelectorAll('p, h1, h2, h3, blockquote');
  const lines = [];
  paras.forEach(p => { const t = p.innerText?.trim(); if (t && t.length > 30) lines.push(t); });
  return { text: lines.join('\n\n') || document.body.innerText?.slice(0, 6000), url: window.location.href };
}

// --- Render results ---
function renderResults(d) {
  // Reset
  document.getElementById('error-box').style.display = 'none';
  ['sec-source', 'sec-claims'].forEach(id => {
    document.getElementById(id).style.display = '';
  });

  const { source, claims, missingContext, perspectives } = d;

  // Source
  document.getElementById('res-source-name').textContent = source.name || 'Unknown';
  document.getElementById('res-source-meta').textContent =
    [source.ownership, source.trustNotes].filter(Boolean).join(' · ');

  const pos = Math.max(0.05, Math.min(0.95, source.biasPosition ?? 0.5));
  document.getElementById('res-bias-dot').style.left = (pos * 100) + '%';

  const biasMap = {
    'left':         { cls: 'left',   label: 'Left-leaning' },
    'left-center':  { cls: 'left',   label: 'Center-left' },
    'center':       { cls: 'center', label: 'Center' },
    'right-center': { cls: 'right',  label: 'Center-right' },
    'right':        { cls: 'right',  label: 'Right-leaning' },
  };
  const binfo = biasMap[source.bias] || biasMap['center'];
  document.getElementById('res-bias-badge').innerHTML =
    `<span class="bias-badge ${binfo.cls}">${binfo.label}</span>`;

  // Claims
  const verdictDot   = { supported: 'supported', disputed: 'disputed', 'needs-context': 'needs-context' };
  const verdictLabel = { supported: 'Supported', disputed: 'Disputed', 'needs-context': 'Needs context' };
  document.getElementById('res-claims').innerHTML = (claims || []).map(c => `
    <div class="claim">
      <div class="claim-dot ${verdictDot[c.verdict] || 'needs-context'}"></div>
      <div>
        <div class="claim-text">${c.text}</div>
        <div class="claim-verdict ${c.verdict || 'needs-context'}">${verdictLabel[c.verdict] || c.verdict}${c.verdictNote ? ' — ' + c.verdictNote : ''}</div>
      </div>
    </div>`).join('');

  // Missing context
  document.getElementById('res-context').innerHTML = (missingContext || []).map(item => `
    <div class="ctx-item">
      <span class="ctx-bullet">›</span>
      <span>${item}</span>
    </div>`).join('');

  // Perspectives
  document.getElementById('res-perspectives').innerHTML = (perspectives || []).map(p => `
    <div class="persp">
      <span class="persp-outlet">${p.outlet}</span>
      <span class="persp-angle">${p.angle}</span>
    </div>`).join('');
}

// --- Init ---
checkKeyAndShowIdle();
