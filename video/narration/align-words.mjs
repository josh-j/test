// Word-level timestamps for a narration track via OpenAI transcription (whisper-1, verbose_json).
// Each paragraph (from <prefix>-XX.timing.json) is transcribed on its own, so a word can never
// drift into another paragraph. Writes <prefix>-XX.words.json: [{ w, start, end, seg }] in track time.
// Usage (from video/): NODE_USE_ENV_PROXY=1 PREFIX=ptb node narration/align-words.mjs 1 2 3
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = process.env.PREFIX ?? 'ptb';
const KEY = process.env.OPENAI_API_KEY;
async function transcribe(file) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(file)], { type: 'audio/wav' }), path.basename(file));
  fd.append('model', 'whisper-1'); fd.append('response_format', 'verbose_json'); fd.append('language', 'en');
  fd.append('timestamp_granularities[]', 'word');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: KEY ? { Authorization: `Bearer ${KEY}` } : {}, body: fd });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()).words;
}
for (const n of process.argv.slice(2).map(Number)) {
  const id = String(n).padStart(2, '0');
  const track = path.join(DIR, `${PREFIX}-${id}.wav`);
  const segs = JSON.parse(readFileSync(path.join(DIR, `${PREFIX}-${id}.timing.json`), 'utf8')).segments;
  const tmp = path.join(DIR, `.tmp-align-${id}`); mkdirSync(tmp, { recursive: true });
  const words = [];
  for (const [i, s] of segs.entries()) {
    const clip = path.join(tmp, `s${i}.wav`), pad = 0.15, from = Math.max(0, s.start - pad);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(from), '-to', String(s.end + pad), '-i', track, clip]);
    for (const w of await transcribe(clip)) {
      const st = Math.min(s.end, Math.max(s.start, from + w.start)), en = Math.min(s.end, Math.max(st, from + w.end));
      words.push({ w: w.word, start: +st.toFixed(2), end: +en.toFixed(2), seg: i });
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(path.join(DIR, `${PREFIX}-${id}.words.json`), JSON.stringify(words) + '\n');
  console.log(`${PREFIX}-${id}: ${words.length} words in ${segs.length} paragraphs`);
}
