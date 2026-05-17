// ContextBot — content script
// Extracts readable article text from the current page

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_ARTICLE') {
    sendResponse({ text: extractArticleText(), url: window.location.href });
  }
});

function extractArticleText() {
  // Priority selectors for article content
  const articleSelectors = [
    'article',
    '[role="article"]',
    '.article-body',
    '.article-content',
    '.story-body',
    '.post-content',
    '.entry-content',
    '.content-body',
    'main article',
    '#article-body',
    '.ArticleBody',
    '.article__body',
    '.story__body',
    '.RichTextStoryBody',
    '.article-text',
  ];

  let articleEl = null;
  for (const sel of articleSelectors) {
    articleEl = document.querySelector(sel);
    if (articleEl) break;
  }

  // Fallback: grab all <p> tags from <main> or <body>
  const container = articleEl || document.querySelector('main') || document.body;

  // Remove noise elements
  const noise = container.querySelectorAll(
    'nav, header, footer, aside, .ad, .advertisement, .social-share, .related-articles, script, style, noscript, figure figcaption'
  );
  noise.forEach(el => el.remove && el.remove());

  // Collect paragraphs
  const paragraphs = container.querySelectorAll('p, h1, h2, h3, h4, blockquote');
  const lines = [];
  paragraphs.forEach(p => {
    const text = p.innerText?.trim();
    if (text && text.length > 30) lines.push(text);
  });

  const text = lines.join('\n\n');

  // If still nothing useful, fallback to full body text
  if (text.length < 200) {
    return document.body.innerText?.slice(0, 6000) || '';
  }

  return text;
}
