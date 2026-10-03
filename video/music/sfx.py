#!/usr/bin/env python3
"""Synthesise a sound-design track from a scene's cue list.

render.mjs writes <video>.cues.json from window.CUES: [{"t": seconds, "type": ..., "gain": ...}].
Types: whoosh (air past the camera), hit (soft low impact on a cut), tick (tiny click for
typing/word builds), pop (small bubble for icons), swell (rising air that peaks at t).

Usage (from video/): python3 music/sfx.py cues.json <duration_s> out.wav [--offset seconds]
Deterministic: same cues -> same file.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def band(x, lo, hi):
    """FFT band-pass with soft edges."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4) / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(spec * g, n=len(x))


def env(n, attack, release):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    r = np.exp(-np.maximum(t - attack, 0) / release)
    return a * r


def whoosh():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # sweep: blend a low band into a high band and back
    lo, hi = band(noise, 200, 900), band(noise, 900, 5000)
    sweep = np.sin(np.pi * np.clip(t / 0.9, 0, 1))
    x = lo * (1 - sweep) + hi * sweep
    shape = np.sin(np.pi * np.clip(t / 0.9, 0, 1)) ** 2
    return x * shape / (np.abs(x).max() + 1e-9) * 0.5


def hit():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 62 * np.exp(-t * 3) + 44  # pitch drops slightly
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.004, 0.35)
    click = band(rng.standard_normal(n), 800, 4000) * env(n, 0.001, 0.015)
    x = body + 0.25 * click / (np.abs(click).max() + 1e-9)
    return x / (np.abs(x).max() + 1e-9) * 0.8


def tick():
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 1700 * t) * env(n, 0.0005, 0.008)
    return x * 0.25


def pop():
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 380 + 600 * np.exp(-t * 40)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.05)
    return x * 0.4


def swell():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    x = band(rng.standard_normal(n), 300, 3000)
    shape = (t / 1.6) ** 2.5
    shape[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
    return x * shape / (np.abs(x).max() + 1e-9) * 0.45


SOUNDS = {'whoosh': (whoosh, 0.45), 'hit': (hit, 0.0), 'tick': (tick, 0.0), 'pop': (pop, 0.0), 'swell': (swell, 1.6)}
# second value: how far before the cue the sound starts (whoosh peaks mid-way, swell ends on the cue)


def main():
    cues = json.load(open(sys.argv[1]))
    duration = float(sys.argv[2])
    out_path = sys.argv[3]
    offset = float(sys.argv[sys.argv.index('--offset') + 1]) if '--offset' in sys.argv else 0.0
    n = int(duration * SR)
    track = np.zeros((n, 2))
    for c in cues:
        make, lead = SOUNDS.get(c['type'], (None, 0))
        if not make:
            continue
        s = make() * float(c.get('gain', 1))
        i0 = int((c['t'] + offset - lead) * SR)
        if i0 >= n:
            continue
        if i0 < 0:
            s, i0 = s[-i0:], 0
        m = min(len(s), n - i0)
        pan = 0.5 + 0.25 * np.sin(c['t'] * 1.7)  # gentle movement across the stereo field
        track[i0:i0 + m, 0] += s[:m] * (1 - pan) * 1.4
        track[i0:i0 + m, 1] += s[:m] * pan * 1.4
    track = np.clip(track, -0.98, 0.98)
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((track * 32767).astype(np.int16).tobytes())
    print(f'wrote {len(cues)} cues to {out_path}')


if __name__ == '__main__':
    main()
