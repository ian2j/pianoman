# Pianoman

Ear-to-key training: sing or hum a note and watch it light up on a piano keyboard, to build a
direct association between what you can already hear and where it lives on a keyboard.

Runs entirely in the browser (Web Audio API + [pitchy](https://www.npmjs.com/package/pitchy) for
real-time pitch detection), so it works on desktop and mobile browsers today and can be wrapped
into an installable PWA later without a rewrite.

## Modes

- **Pitch Mirror** — sing or hum; the matching key highlights live, with a cents tuning meter.
- **Reference Piano** — click keys or play the QWERTY rows (A-J, K-]) to hear ground-truth pitches.
- **Sing-Back Trainer** — the app plays a target note, you sing it back, and it confirms the match
  once you've held the pitch steady. Tracks a streak; range is adjustable.
- **Melody Follow** — pick a short built-in melody, sing along as it plays/highlights each note in
  turn, and get a per-note + overall score.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm test         # vitest — note/midi/frequency/keyboard-layout math
```

Microphone access requires a real browser with mic hardware — it won't work in a sandboxed or
headless environment.

## Project layout

- `src/music/` — pure note/midi/frequency conversions and keyboard layout math (unit tested).
- `src/audio/` — mic capture (AudioWorklet), pitch detection (wraps `pitchy`), and the reference
  tone synth.
- `src/ui/` — shared components: the SVG keyboard, tuner meter, and mode tab bar.
- `src/modes/` — the four modes above, each a `{ mount(container), needsMic }` module.
- `legacy/` — the original pygame prototypes this was rebuilt from, kept for reference.
