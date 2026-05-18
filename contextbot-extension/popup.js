// ContextBot — popup.js

const views = {
  idle: document.getElementById('view-idle'),
  account: document.getElementById('view-account'),
  loading: document.getElementById('view-loading'),
  results: document.getElementById('view-results'),
};

function showView(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('active', k === name));
}

let currentUser = null;
let currentAuthMode = 'login';
let accountOpen = false;

document.getElementById('toggle-account').addEventListener('click', () => {
  accountOpen = !accountOpen;
  if (accountOpen) {
    showView('account');
    updateAccountUI();
  } else {
    showView('idle');
  }
});

function switchAuthTab(tab) {
  currentAuthMode = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('acc-submit-btn').textContent = tab === 'login' ? 'Log In' : 'Sign Up';
  document.getElementById('acc-error-box').style.display = 'none';
}

document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
document.getElementById('tab-signup').addEventListener('click', () => switchAuthTab('signup'));

function updateAccountUI() {
  document.getElementById('acc-error-box').style.display = 'none';
  if (currentUser && !currentUser.email.startsWith('demo-')) {
    document.getElementById('acc-form-view').style.display = 'none';
    document.getElementById('acc-profile-view').style.display = 'block';
    document.getElementById('acc-val-email').textContent = currentUser.email;
    document.getElementById('acc-val-tier').textContent = currentUser.tier;
    if (currentUser.tier === 'pro') {
      document.getElementById('acc-pro-badge').style.display = 'inline';
      document.getElementById('acc-upgrade-section').style.display = 'none';
    } else {
      document.getElementById('acc-pro-badge').style.display = 'none';
      document.getElementById('acc-upgrade-section').style.display = 'block';
    }
  } else {
    document.getElementById('acc-form-view').style.display = 'block';
    document.getElementById('acc-profile-view').style.display = 'none';
    switchAuthTab('login');
  }
}

document.getElementById('acc-submit-btn').addEventListener('click', async () => {
  const email = document.getElementById('acc-email').value.trim();
  const password = document.getElementById('acc-password').value.trim();
  const errorEl = document.getElementById('acc-error-box');
  
  if (!email || !password) {
    errorEl.textContent = 'Email and password required.';
    errorEl.style.display = 'block';
    return;
  }
  
  const endpoint = currentAuthMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
  try {
    const res = await fetch(`http://localhost:5001${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Auth failed');
    
    await chrome.storage.local.set({ cb_token: data.token });
    currentUser = data.user;
    updateAccountUI();
    document.getElementById('acc-email').value = '';
    document.getElementById('acc-password').value = '';
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  }
});

document.getElementById('acc-logout-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove('cb_token');
  currentUser = null;
  accountOpen = false;
  showView('idle');
  initializeSession(); // generate a new demo token
});

document.getElementById('acc-upgrade-btn').addEventListener('click', async () => {
  const { cb_token } = await chrome.storage.local.get('cb_token');
  if (!cb_token) return;
  try {
    const res = await fetch('http://localhost:5001/api/billing/upgrade', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cb_token}` }
    });
    const data = await res.json();
    if (res.ok && data.url) {
      chrome.tabs.create({ url: data.url }); // Open Stripe in new tab
    } else {
      throw new Error(data.error || 'Failed to open checkout');
    }
  } catch (e) {
    const errorEl = document.getElementById('acc-error-box');
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  }
});

// --- Session Init ---
async function initializeSession() {
  const { cb_token } = await chrome.storage.local.get('cb_token');
  if (cb_token) {
    // Try to fetch real profile
    try {
      const pRes = await fetch('http://localhost:5001/api/auth/me', {
        headers: { 'Authorization': `Bearer ${cb_token}` }
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        currentUser = pData.user;
      }
    } catch (e) {}

    document.getElementById('analyze-btn').disabled = false;
    showView('idle');
    return;
  }
  
  // Auto-generate a demo account if no token
  try {
    const email = `demo-${Date.now()}@contextbot.com`;
    const res = await fetch('http://localhost:5001/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'demo' })
    });
    
    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({ cb_token: data.token });
      document.getElementById('analyze-btn').disabled = false;
      showView('idle');
    } else {
      throw new Error('Signup failed');
    }
  } catch (e) {
    console.error('Session init error:', e);
    const box = document.getElementById('error-box');
    box.textContent = 'Could not connect to ContextBot servers.';
    box.style.display = 'block';
  }
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

    const { cb_token } = await chrome.storage.local.get('cb_token');
    if (!cb_token) throw new Error('No session token found. Please reopen the extension.');

    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_ARTICLE',
      payload: { text: articleData.text, url: articleData.url, token: cb_token }
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
initializeSession();
