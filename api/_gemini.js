// Shared Google Gemini REST helper + token-usage logging.
// Used by the AI schedule generator and the AI assistant chat.

// Call Gemini and return { text, usage }. Throws errors carrying a statusCode
// and a user-facing message (missing key, network, bad response, rate limit).
async function geminiRequest(prompt, { json = false, temperature = 0.4 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const e = new Error('AI is not configured. Add a GEMINI_API_KEY environment variable in Vercel to enable it.');
    e.statusCode = 503;
    throw e;
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const generationConfig = { temperature };
  if (json) generationConfig.responseMimeType = 'application/json';

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    });
  } catch {
    const e = new Error('Could not reach the Gemini API. Check the network/API key and try again.');
    e.statusCode = 502;
    throw e;
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const e = new Error(`Gemini API error (${resp.status}). ${resp.status === 400 || resp.status === 403 ? 'Check that your GEMINI_API_KEY is valid.' : resp.status === 429 ? 'Free-tier rate limit hit — wait a moment and try again.' : ''} ${body.slice(0, 200)}`.trim());
    e.statusCode = resp.status === 429 ? 429 : 502;
    throw e;
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const um = data?.usageMetadata || {};
  const usage = {
    prompt: um.promptTokenCount || 0,
    output: um.candidatesTokenCount || 0,
    total: um.totalTokenCount || ((um.promptTokenCount || 0) + (um.candidatesTokenCount || 0)),
  };
  return { text, usage };
}

// Parse a JSON array out of a model response (tolerates ```json fences / wrapper objects).
function parseJsonArray(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/g, '').trim();
  try {
    const p = JSON.parse(cleaned);
    return Array.isArray(p) ? p : (p.schedule || p.entries || p.items || []);
  } catch {
    const e = new Error('The AI returned an unexpected format. Please try again.');
    e.statusCode = 502;
    throw e;
  }
}

async function ensureAiUsageTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS ai_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kind VARCHAR(30) NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
}

// Best-effort usage record; never throws (usage logging must not break a request).
async function logAiUsage(pool, kind, usage) {
  try {
    await ensureAiUsageTable(pool);
    await pool.query(
      'INSERT INTO ai_usage (kind, prompt_tokens, output_tokens, total_tokens) VALUES (?,?,?,?)',
      [kind, usage?.prompt || 0, usage?.output || 0, usage?.total || 0]
    );
  } catch { /* ignore */ }
}

module.exports = { geminiRequest, parseJsonArray, ensureAiUsageTable, logAiUsage };
