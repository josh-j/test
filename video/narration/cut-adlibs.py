"""Remove words the TTS spoke that are not in the script (it sometimes reads the next
paragraph early). Cuts [cut_from, paragraph end] out of <prefix>-XX.wav and .voice.wav,
then shifts the timing and words sidecars. Usage: python3 narration/cut-adlibs.py 1:0 7:2 8:3 8:4"""
import json, subprocess, sys, os
D = os.path.dirname(os.path.abspath(__file__))
for arg in sys.argv[1:]:
    ch, seg = map(int, arg.split(':'))
    tj = f'{D}/ptb-0{ch}.timing.json'; wj = f'{D}/ptb-0{ch}.words.json'
    T = json.load(open(tj)); W = json.load(open(wj)); S = T['segments'][seg]
    script_last = S['text'].split()[-1].strip('.,?!;:—"\'').lower()
    mine = [w for w in W if w['seg'] == seg]
    # last occurrence of the paragraph's final scripted word before the ad-lib
    idx = max(i for i, w in enumerate(mine) if w['w'].strip('.,?!').lower() == script_last and i < len(mine) - 1)
    a = round(mine[idx]['end'] + 0.25, 2); b = S['end']
    cut = round(b - a, 2)
    for f in (f'{D}/ptb-0{ch}.wav', f'{D}/ptb-0{ch}.voice.wav'):
        tmp = f + '.tmp.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f, '-filter_complex',
                        f'[0:a]atrim=0:{a},asetpts=N/SR/TB[x];[0:a]atrim={b},asetpts=N/SR/TB[y];[x][y]concat=n=2:v=0:a=1[o]', '-map', '[o]', tmp], check=True)
        os.replace(tmp, f)
    S['end'] = a
    for s in T['segments'][seg + 1:]: s['start'] = round(s['start'] - cut, 2); s['end'] = round(s['end'] - cut, 2)
    W = [w for w in W if not (w['seg'] == seg and w['start'] >= a)]
    for w in W:
        if w['seg'] > seg: w['start'] = round(w['start'] - cut, 2); w['end'] = round(w['end'] - cut, 2)
    json.dump(T, open(tj, 'w'), indent=2); open(tj, 'a').write('\n')
    open(wj, 'w').write(json.dumps(W) + '\n')
    print(f'ch{ch} p{seg}: cut {a}-{b} ({cut}s) after "{mine[idx]["w"]}"')
