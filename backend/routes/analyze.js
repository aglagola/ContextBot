const express = require('express');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const db = require('../db/database');

const router = express.Router();

router.post('/', verifyToken, rateLimit, async (req, res) => {
  const { content } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!content) {
    // If request fails due to bad input, we might want to decrement usage (optional, skipping for now)
    return res.status(400).json({ error: 'Content is required for analysis' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key is not configured' });
  }

  try {
    const promptPath = path.join(__dirname, '..', 'prompts', 'system_prompt.txt');
    let systemPrompt = 'You are ContextBot, a media intelligence assistant.';
    
    if (fs.existsSync(promptPath)) {
      systemPrompt = fs.readFileSync(promptPath, 'utf8');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Input: ${content}` }]
      })
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      // If Anthropic fails, we could refund the usage point here by updating DB
      return res.status(response.status).json({ error: `Anthropic API error: ${errorMsg}` });
    }

    const data = await response.json();
    const rawText = data.content.map(block => block.text || '').join('');
    const cleanJSON = rawText.replace(/```json|```/g, '').trim();
    
    const parsedData = JSON.parse(cleanJSON);
    
    // Include remaining usage info if free tier
    let usageInfo = {};
    if (req.user.tier === 'free') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usage = db.prepare('SELECT count FROM usage WHERE user_id = ? AND month = ?').get(req.user.id, currentMonth);
      usageInfo = { used: usage ? usage.count : 1, limit: 10 };
    }

    res.json({ analysis: parsedData, usage: usageInfo });
  } catch (error) {
    console.error('Server error during analysis:', error);
    res.status(500).json({ error: 'Internal server error occurred during analysis.' });
  }
});

module.exports = router;
