#!/usr/bin/env python3
"""Soft ambient bed for "The Hospital That Must Change Shape".

Slow, warm pad chords (D major family), a little filtered air, and sparse distant
piano-like notes. Deterministic (seeded), so the same command always gives the same file.

Usage (from video/): python3 music/ambient.py <seconds> <out.wav>
Then add reverb and mix under the narration with build-hospital-film.sh.
"""
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(20261003)


def hz(note):
    """MIDI note number to frequency."""
    return 440.0 * 2 ** ((note - 69) / 12)


# D major family, voiced low and open. MIDI numbers.
CHORDS = [
    [38, 45, 50, 54, 57, 64],  # Dadd9
    [35, 42, 50, 54, 57, 61],  # Bm7-ish (B, F#, D, F#, A, C#)
    [31, 43, 50, 54, 57, 59],  # Gmaj7 (G, G, D, F#, A, B)
    [33, 45, 50, 52, 57, 62],  # Asus (A, A, D, E, A, D)
]
CHORD_LEN = 22.0   # seconds per chord
XFADE = 7.0        # crossfade between chords


def pad(duration):
    n = int(duration * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    n_chords = int(np.ceil(duration / CHORD_LEN)) + 1
    for ci in range(n_chords):
        chord = CHORDS[ci % len(CHORDS)]
        start = ci * CHORD_LEN - XFADE / 2
        end = start + CHORD_LEN + XFADE
        # raised-cosine envelope for each chord, overlapping its neighbours
        env = np.clip((t - start) / XFADE, 0, 1) * np.clip((end - t) / XFADE, 0, 1)
        env = 0.5 - 0.5 * np.cos(np.pi * env)
        active = env > 0
        if not active.any():
            continue
        tt = t[active]
        for vi, note in enumerate(chord):
            f = hz(note)
            amp = 0.5 / (1 + vi * 0.35)            # lower voices a little louder
            lfo = 0.75 + 0.25 * np.sin(2 * np.pi * (0.03 + 0.011 * vi) * tt + rng.uniform(0, 6.28))
            for ch, detune in ((0, -0.12), (1, 0.12)):  # gentle chorus, stereo width
                ph = rng.uniform(0, 6.28)
                wave_ = np.sin(2 * np.pi * (f + detune) * tt + ph)
                wave_ += 0.18 * np.sin(2 * np.pi * 2 * (f + detune) * tt + ph * 1.3)  # soft 2nd harmonic
                out[active, ch] += amp * lfo * env[active] * wave_
    return out


def air(duration):
    """Very quiet, slowly breathing low-passed noise."""
    n = int(duration * SR)
    noise = lowpass(rng.standard_normal((n, 2)), 300)
    noise /= np.sqrt(np.mean(noise ** 2))
    t = np.arange(n) / SR
    swell = 0.5 + 0.5 * np.sin(2 * np.pi * 0.021 * t)
    return noise * swell[:, None] * 0.15


def piano(duration):
    """Sparse, distant bell-like notes from the D major pentatonic, roughly every 7–12 s."""
    n = int(duration * SR)
    out = np.zeros((n, 2))
    scale = [62, 64, 66, 69, 71, 74, 76, 78]
    at = 6.0
    while at < duration - 6:
        f = hz(scale[rng.integers(len(scale))])
        length = 5.0
        i0 = int(at * SR)
        m = min(int(length * SR), n - i0)
        tt = np.arange(m) / SR
        env = np.exp(-tt * 1.1) * np.clip(tt / 0.04, 0, 1)  # soft attack, no click
        tone = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 2.5)
        pan = rng.uniform(0.3, 0.7)
        out[i0:i0 + m, 0] += tone * env * (1 - pan) * 0.35
        out[i0:i0 + m, 1] += tone * env * pan * 0.35
        at += rng.uniform(7, 12)
    return out


def lowpass(x, cutoff):
    """Simple FFT low-pass with a soft roll-off (whole-file, offline)."""
    spec = np.fft.rfft(x, axis=0)
    freqs = np.fft.rfftfreq(x.shape[0], 1 / SR)
    gain = 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec * gain[:, None], n=x.shape[0], axis=0)


def main():
    duration = float(sys.argv[1])
    out_path = sys.argv[2]
    mix = pad(duration) + 0.25 * air(duration) + piano(duration)
    mix = lowpass(mix, 2400)
    n = mix.shape[0]
    t = np.arange(n) / SR
    fade = np.clip(t / 5.0, 0, 1) * np.clip((duration - t) / 8.0, 0, 1)
    mix *= fade[:, None]
    # normalise to a modest level; the film mix sets the final volume
    rms = np.sqrt(np.mean(mix ** 2))
    mix *= (10 ** (-20 / 20)) / max(rms, 1e-9)
    mix = np.clip(mix, -0.98, 0.98)
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'wrote {duration:.1f}s to {out_path}')


if __name__ == '__main__':
    main()
