const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Endpoint to analyze articles
app.post('/api/analyze', async (req, res) => {
  const { content } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!content) {
    return res.status(400).json({ error: 'Content is required for analysis' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key is not configured on the server' });
  }

  try {
    // Read prompt from the system prompt template file
    const promptPath = path.join(__dirname, 'prompts', 'system_prompt.txt');
    let systemPrompt = 'You are ContextBot, a media intelligence assistant.';
    
    if (fs.existsSync(promptPath)) {
      systemPrompt = fs.readFileSync(promptPath, 'utf8');
    }

    // Call Anthropic API using Node standard Fetch API (supported in modern Node.js)
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
      return res.status(response.status).json({ error: `Anthropic API error: ${errorMsg}` });
    }

    const data = await response.json();
    const rawText = data.content.map(block => block.text || '').join('');
    const cleanJSON = rawText.replace(/```json|```/g, '').trim();
    
    const parsedData = JSON.parse(cleanJSON);
    res.json(parsedData);
  } catch (error) {
    console.error('Server error during analysis:', error);
    res.status(500).json({ error: 'Internal server error occurred during analysis.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`ContextBot backend server running on port ${PORT}`);
});
