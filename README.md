# ContextBot 🕵️

> Read smarter, not harder.

ContextBot is a browser extension (and web prototype) that gives you an instant intelligence brief on any article you're reading — who's behind it, what claims it makes, what it leaves out, and how other outlets cover the same story.

---

## Screenshots

<img width="364" height="246" alt="Screenshot 2026-05-18 at 3 16 34 PM" src="https://github.com/user-attachments/assets/e86c6d39-8143-4651-b0bc-54a824e774bf" />

<img width="361" height="294" alt="Screenshot 2026-05-18 at 3 17 06 PM" src="https://github.com/user-attachments/assets/a6a6c327-099c-448e-ab98-ec251a7c40ad" />

<img width="361" height="294" alt="Screenshot 2026-05-18 at 3 17 29 PM" src="https://github.com/user-attachments/assets/cabce75a-ad71-49ae-9a05-032c7104e022" />

<img width="361" height="359" alt="Screenshot 2026-05-18 at 3 18 01 PM" src="https://github.com/user-attachments/assets/96b68af2-96a2-4131-8868-b3b3d2be0754" />

---

## What it does

Paste an article URL or text, and ContextBot returns four panels of analysis powered by Claude AI:

- **Source intelligence** — publication ownership, funding, and political bias positioning
- **Key claims** — the article's main factual assertions, rated as supported, disputed, or needing context
- **Missing context** — facts, counterarguments, or background the article doesn't mention
- **Other perspectives** — how different outlets would likely frame the same story

---

## Project structure

```
contextbot/
├── prototype/          # Web app demo (this repo)
│   └── index.html      # Single-file prototype powered by Claude API
├── extension/          # Chrome extension (coming soon)
│   ├── manifest.json
│   ├── content.js
│   ├── sidebar.html
│   └── background.js
├── backend/            # API server (coming soon)
│   ├── server.js
│   └── prompts/
└── README.md
```

---

## Running the prototype

The prototype is a single HTML file that calls the Anthropic API directly from the browser.

### Prerequisites

- An [Anthropic API key](https://console.anthropic.com/)
- A local server (e.g. `npx serve` or VS Code Live Server)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/yourname/contextbot.git
   cd contextbot/prototype
   ```

2. Open `index.html` and add your API key:
   ```javascript
   headers: {
     "x-api-key": "YOUR_API_KEY_HERE",
     ...
   }
   ```

3. Serve locally:
   ```bash
   npx serve .
   ```

4. Open `http://localhost:3000` in your browser.

> ⚠️ **Note:** Embedding API keys in client-side code is fine for local prototyping but should never be shipped to production. The full extension will route requests through a backend server.

---

## How it works

```
User pastes URL or text
        ↓
Extension extracts article content
        ↓
Request sent to backend API
        ↓
Backend calls Claude with structured prompt
        ↓
Claude returns JSON: source, claims, context, perspectives
        ↓
Sidebar renders the intelligence brief
```

The Claude prompt instructs the model to return a strict JSON schema — no markdown, no preamble — which is then parsed and rendered into the four-panel UI.

---

## Roadmap

### v0.1 — Prototype ✅
- [x] Web app demo with URL and text input
- [x] Claude-powered analysis (source, claims, context, perspectives)
- [x] Bias positioning bar
- [x] Claim verdict system (supported / disputed / needs context)

### v0.2 — Chrome extension
- [ ] Manifest V3 extension shell
- [ ] Auto-detect article pages
- [ ] Sidebar panel injected into page
- [ ] One-click analysis button

### v0.3 — Backend & auth
- [ ] Node.js / FastAPI backend
- [ ] API key management server-side
- [ ] Rate limiting per user
- [ ] Web search integration for related articles

### v1.0 — Freemium launch
- [ ] User accounts
- [ ] 10 free analyses/month
- [ ] $5–7/month unlimited plan
- [ ] Firefox support

---

## Tech stack

| Layer | Technology |
|---|---|
| Prototype UI | Vanilla HTML/CSS/JS |
| Extension | Chrome Manifest V3, vanilla JS |
| AI | Claude (claude-sonnet-4) via Anthropic API |
| Backend (planned) | Node.js or Python FastAPI |
| Hosting (planned) | Railway or Render |

---

## Contributing

Pull requests welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## License

MIT
