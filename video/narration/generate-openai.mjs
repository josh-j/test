// Generate the narration with OpenAI text-to-speech, one paragraph at a time,
// then join the paragraphs with controlled pauses into scene-XX.wav.
//
// Usage (from video/):
//   OPENAI_API_KEY=sk-... node narration/generate-openai.mjs            # all scenes
// Behind an HTTPS proxy (e.g. cloud sessions), add NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
//   OPENAI_API_KEY=sk-... node narration/generate-openai.mjs 1 7        # selected scenes
//   VOICE=onyx SPEED=1.0 node narration/generate-openai.mjs 1           # audition another voice
//
// Requires Node 18+ and ffmpeg.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.MODEL ?? 'gpt-4o-mini-tts';
const VOICE = process.env.VOICE ?? 'cedar';
const SPEED = Number(process.env.SPEED ?? 1.0);
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error('Set OPENAI_API_KEY first.');
  process.exit(1);
}

const BASE = `Voice: a warm, older British narrator with received pronunciation. Softly spoken, slight gravel, close to the microphone.
Tone: calm, gently curious and observational, like a natural-history documentary. Understated, with quiet wonder and occasional dry warmth. Never dramatic, never salesy, never upbeat.
Pacing: unhurried, about 125 words per minute. Let commas breathe; leave a short natural pause after each sentence.
Do not imitate any specific real person.`;

// Per-scene direction (mirrors SCRIPT.md).
const SCENE = {
  1: 'Hushed, as if not to wake the building. "the part that waits" slower, almost tender. End lightly, with curiosity.',
  2: 'Plain and explanatory, like describing a creature\'s habits. Neutral when comparing countries. Firm and reassuring on "a doctor\'s decision".',
  3: 'Even-handed: fairly reporting the insurers\' view. Gentle understatement on "Yet its people live no longer". Say "It is the cure." quietly.',
  4: 'Wider and slower, calm, not alarmed. Sympathetic on "Each decision is reasonable." Let the last sentence descend in pitch.',
  5: 'Observational and slightly wry on "On paper". Hushed on "the part that cannot sleep". Let "The new price is already here." land quietly.',
  6: 'Practical and quietly hopeful. "Who pays for a new shape?" as a genuine question. Slight emphasis on "Once". Steady rhythm on the final list.',
  7: 'The most intimate scene: softer, slower, warmer. "It was the care." almost under the breath. Give each of the last three images a beat.',
  8: 'Return to the opening register: night, stillness, reflection. No blame on "No one in the chain chose this." Let the final phrase trail gently.',
};

// Silence (seconds) after each paragraph, by scene; the last value repeats. Final value is the tail.
const PAUSES = {
  1: [1.0, 2.0, 1.0, 1.0],
  3: [1.0, 1.5, 1.0],
  5: [1.0, 1.0, 1.5, 1.0],
  7: [1.0, 2.0, 1.0, 1.0],
  8: [1.0, 1.0, 2.0, 1.5],
};

async function speak(text, instructions, out) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, instructions, speed: SPEED, response_format: 'wav' }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

const scenes = process.argv.slice(2).map(Number);
for (const n of scenes.length ? scenes : [1, 2, 3, 4, 5, 6, 7, 8]) {
  const id = String(n).padStart(2, '0');
  const paras = readFileSync(path.join(DIR, `scene-${id}.txt`), 'utf8').trim().split(/\n\s*\n/);
  const tmp = path.join(DIR, `.tmp-${id}`);
  mkdirSync(tmp, { recursive: true });

  const inputs = [];
  for (const [i, p] of paras.entries()) {
    const f = path.join(tmp, `p${i}.wav`);
    process.stdout.write(`scene ${id} paragraph ${i + 1}/${paras.length}\r`);
    await speak(p, `${BASE}\nThis scene: ${SCENE[n]}`, f);
    inputs.push(f);
  }

  // Join paragraphs with pauses: [p0][gap0][p1][gap1]...[pN][tail]
  const pauses = PAUSES[n] ?? [1.0];
  const args = ['-y', '-loglevel', 'error'];
  const parts = [];
  inputs.forEach((f, i) => {
    args.push('-i', f);
    const gap = pauses[Math.min(i, pauses.length - 1)];
    args.push('-f', 'lavfi', '-t', String(gap), '-i', 'anullsrc=r=24000:cl=mono');
    parts.push(`[${i * 2}:a]`, `[${i * 2 + 1}:a]`);
  });
  const filter = `${parts.join('')}concat=n=${parts.length}:v=0:a=1[out]`;
  const out = path.join(DIR, `scene-${id}.wav`);
  execFileSync('ffmpeg', [...args, '-filter_complex', filter, '-map', '[out]', out]);
  rmSync(tmp, { recursive: true, force: true });

  const secs = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`scene ${id}: ${Number(secs).toFixed(1)}s → ${path.relative(process.cwd(), out)}        `);
}
