const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Anti-Insult Filter
const FORBIDDEN_WORDS = [
  'idiot', 'stupid', 'dumb', 'fool', 'trash',
  'bitch', 'bastard', 'asshole', 'fucker', 'shit', 'niga', 'nigger'
];

// NSFW Keyword Filter
const NSFW_KEYWORDS = [
  'naked', 'porn', 'sex', 'boobs', 'butt', 'ass', 'nude', 'nsfw', 'genitals'
];

function containsInsults(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some(word => new RegExp(`\\b${word}\\b`, 'i').test(lower));
}

function containsNSFW(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return NSFW_KEYWORDS.some(word => lower.includes(word));
}

// Groq API Call
async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
  if (!apiKey) return '';

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an assistant for Roblox Studio Luau development.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5
      })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('[GROQ ERROR]:', err.message);
    return '';
  }
}

// Gemini API Call
async function callGemini(geminiPrompt, modelName = 'gemini-3.8-flash') {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: geminiPrompt }] }]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    throw new Error(errorMsg);
  }

  const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResult) {
    throw new Error('No content returned from Gemini model.');
  }

  return textResult;
}

// Dual-AI Processing Engine
async function processAIRequest(prompt, userAge) {
  const groqDraft = await callGroq(prompt);

  const geminiPrompt = `You are the Master AI Scripting Assistant for Roblox Studio (Luau).
Target Audience Age Rating: ${userAge}+

User Request: "${prompt}"
Initial Code Structure: "${groqDraft}"

Generate working, safe, optimized Luau scripts and Studio instructions matching the target age rating.`;

  try {
    const result = await callGemini(geminiPrompt, 'gemini-3.8-flash');
    return { success: true, result };
  } catch (err) {
    console.error('[GEMINI ERROR]:', err.message);
    return { success: false, result: `[Gemini Error]: ${err.message}` };
  }
}

// AI Generation Route
app.post('/api/ai/generate', async (req, res) => {
  const timestamp = new Date().toLocaleTimeString();
  const { prompt, age, username } = req.body;
  const userAge = parseInt(age) || 3;

  console.log(`\n--------------------------------------------------`);
  console.log(`[${timestamp}] Request from User: ${username || 'Unknown'} | Age Rating: ${userAge}+`);
  console.log(`[Prompt]: "${prompt}"`);

  if (!prompt) {
    return res.status(400).json({ success: false, result: 'Prompt is required.' });
  }

  if (containsInsults(prompt)) {
    return res.status(400).json({
      success: false,
      result: "[Moderation Block]: Your message contains inappropriate language or insults. Please rephrase politely."
    });
  }

  if (containsNSFW(prompt)) {
    return res.status(403).json({
      success: false,
      result: "This is NSFW. Please don't continue. Adult/sexually explicit content is strictly prohibited."
    });
  }

  if (prompt.toLowerCase().includes('blood') && userAge < 18) {
    return res.status(403).json({
      success: false,
      result: "[Age Restriction]: Gore and blood features require an age setting of 18+."
    });
  }

  const responseData = await processAIRequest(prompt, userAge);
  console.log(`[${timestamp}] Processing complete.`);
  console.log(`--------------------------------------------------\n`);

  res.json(responseData);
});

app.get('/', (req, res) => {
  res.send('AMRORO AI Backend Server running.');
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 AMRORO AI Server listening on port ${PORT}`));
}

module.exports = app;