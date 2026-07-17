// Shared Google Gemini REST helper + token-usage logging.
// Used by the AI schedule generator and the AI assistant chat.

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Extract a clean message + suggested retry delay (seconds) from a Gemini error body.
// Google returns { error: { code, message, status, details: [{ '@type': '...RetryInfo', retryDelay: '36s' }] } }.
function parseGeminiError(status, bodyText) {
  let message = '';
  let retryAfter = null;
  try {
    const parsed = JSON.parse(bodyText);
    message = parsed?.error?.message || '';
    const retryInfo = parsed?.error?.details?.find(d => String(d['@type'] || '').includes('RetryInfo'));
    if (retryInfo?.retryDelay) {
      const m = String(retryInfo.retryDelay).match(/(\d+(\.\d+)?)s/);
      if (m) retryAfter = Math.ceil(parseFloat(m[1]));
    }
  } catch {
    message = String(bodyText || '').slice(0, 200);
  }

  if (status === 429) {
    return {
      retryAfter,
      friendly: `You've hit the Gemini free-tier rate limit${retryAfter ? ` — try again in about ${retryAfter}s` : ' — wait a moment and try again'}. If this keeps happening, the daily free quota may be used up; it resets at midnight Pacific time, or you can set GEMINI_MODEL=gemini-2.0-flash-lite in Vercel for a higher free quota.`,
    };
  }
  if (status === 400 || status === 403) {
    return { retryAfter, friendly: `Gemini rejected the request${message ? `: ${message}` : ''}. Check that GEMINI_API_KEY is valid and the API is enabled for it.` };
  }
  return { retryAfter, friendly: `Gemini API error (${status})${message ? `: ${message}` : ''}` };
}

// Call Gemini and return { text, usage }. Throws errors carrying a statusCode
// and a clean, user-facing message (missing key, network, bad response, rate limit).
// Automatically retries once on a 429/503 using Google's suggested retry delay
// (or a short default), since free-tier rate limits are often transient.
async function geminiRequest(prompt, { json = false, temperature = 0.4, _retried = false } = {}) {
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
    const bodyText = await resp.text().catch(() => '');
    const { retryAfter, friendly } = parseGeminiError(resp.status, bodyText);

    // One automatic retry for transient rate-limit/server errors, capped at 8s wait
    // (Vercel functions have limited execution time, so we don't wait longer).
    if (!_retried && (resp.status === 429 || resp.status === 503)) {
      await sleep(Math.min((retryAfter || 3) * 1000, 8000));
      return geminiRequest(prompt, { json, temperature, _retried: true });
    }

    const e = new Error(friendly);
    e.statusCode = resp.status === 429 ? 429 : 502;
    if (retryAfter) e.retryAfter = retryAfter;
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
