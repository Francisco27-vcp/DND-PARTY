// api/chat.js — Vercel serverless function
// Proxies chat requests to the Anthropic API and augments with RAG from D&D manuals.

const STOPWORDS = new Set([
  // Spanish
  'el','la','los','las','de','del','en','a','y','o','u','que','se','un','una',
  'es','con','por','para','al','lo','le','me','te','nos','su','sus','mi','mis',
  'tu','tus','no','si','hay','ser','mas','como','cual','cuales','cuando','donde',
  'quien','este','esta','estos','estas','ese','esa','esos','esas','aquel','pero',
  'sin','sobre','entre','hasta','desde','ante','tras','durante','mediante','segun',
  'hacia','bajo','cada','todo','toda','todos','todas','muy','bien','asi','ya',
  'tambien','solo','puede','pueden','tiene','tienen','hacer','haber','estar',
  'son','han','era','fue','ha','he','les','ni','e','sino','aunque','porque',
  'pues','luego','algo','algun','alguna','algunos','algunas',
  // English
  'the','an','is','are','was','were','be','been','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can','of','in',
  'to','for','on','at','by','with','from','or','and','but','not','this','that',
  'these','those','it','they','them','their','what','which','who','when','where',
  'how','its','you','he','she','we',
]);

// Module-level cache — persists across requests in a warm Lambda instance.
let chunks = null;
let normalizedTexts = null;

function loadIndex() {
  if (chunks) return;
  // require() caches the parsed JSON at the Node.js module level.
  chunks = require('../src/data/manuals_chunks.json');
  normalizedTexts = chunks.map(c => normalizeText(c.text));
}

// The source JSON contains UTF-8→Latin-1 mojibake for Spanish characters.
// We fix the lowercase accented letters (most common in body text), then
// lowercase and strip all remaining diacritics so query and text normalize identically.
function normalizeText(text) {
  return text
    .replace(/Ã¡/g, 'a') // á
    .replace(/Ã©/g, 'e') // é
    .replace(/Ã­/g, 'i') // í
    .replace(/Ã³/g, 'o') // ó
    .replace(/Ãº/g, 'u') // ú
    .replace(/Ã±/g, 'n') // ñ
    .replace(/Ã¼/g, 'u') // ü
    .replace(/Ã§/g, 'c') // ç
    .replace(/Ã¶/g, 'o') // ö
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function extractKeywords(query) {
  return [...new Set(
    normalizeText(query).split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
  )];
}

function searchChunks(query, topK = 6, minScore = 2) {
  loadIndex();
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const results = normalizedTexts.map((normText, i) => {
    let score = 0;
    for (const kw of keywords) {
      let pos = normText.indexOf(kw);
      while (pos !== -1) {
        score++;
        pos = normText.indexOf(kw, pos + 1);
      }
    }
    return { score, chunk: chunks[i] };
  });

  results.sort((a, b) => b.score - a.score);
  if (results[0].score < minScore) return [];
  return results.slice(0, topK).filter(r => r.score > 0).map(r => r.chunk);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on the server.' });
  }

  const { messages, systemPrompt, skipRAG, maxTokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  // Use the last user message for RAG retrieval.
  // Skip RAG when the caller doesn't need D&D manual context (e.g. generate-session mode).
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const query = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

  const relevantChunks = skipRAG ? [] : searchChunks(query);

  let finalSystemPrompt = systemPrompt || '';
  if (relevantChunks.length > 0) {
    const ragSection = relevantChunks
      .map(c => {
        const loc = c.chapter != null ? `Capítulo ${c.chapter}: ${c.chapter_title}` : c.chapter_title;
        return `[${c.source} — ${loc}]\n${c.text}`;
      })
      .join('\n\n---\n\n');
    finalSystemPrompt +=
      '\n\n## Fragmentos relevantes de los manuales de D&D\n\n' +
      'Usa la siguiente información como referencia cuando sea pertinente:\n\n' +
      ragSection;
  }

  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens || 2048,
        stream: true,
        system: finalSystemPrompt,
        messages,
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'No se pudo conectar con la API de Anthropic.' });
  }

  if (!anthropicRes.ok) {
    const errData = await anthropicRes.json().catch(() => ({}));
    return res.status(anthropicRes.status).json(errData);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = anthropicRes.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
};
