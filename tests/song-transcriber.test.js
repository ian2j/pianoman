import { describe, expect, it } from 'vitest';
import { segmentNotes, smoothFrames } from '../src/audio/song-transcriber.js';

function frames(entries, hopMs = 10) {
  return entries.map((note, i) => ({ timeMs: i * hopMs, note }));
}

describe('smoothFrames', () => {
  it('fills in a single-frame dropout surrounded by the same note', () => {
    const input = frames(['C4', 'C4', null, 'C4', 'C4']);
    const smoothed = smoothFrames(input, 5);
    expect(smoothed.map((f) => f.note)).toEqual(['C4', 'C4', 'C4', 'C4', 'C4']);
  });

  it('picks the majority note within the window over a brief flicker', () => {
    const input = frames(['C4', 'C4', 'C4', 'D4', 'C4', 'C4', 'C4']);
    const smoothed = smoothFrames(input, 5);
    expect(smoothed[3].note).toBe('C4');
  });

  it('leaves genuine silence as null when nothing voiced is nearby', () => {
    const input = frames([null, null, null, null, null]);
    const smoothed = smoothFrames(input, 5);
    expect(smoothed.every((f) => f.note === null)).toBe(true);
  });
});

describe('segmentNotes', () => {
  it('merges consecutive identical notes into a single event', () => {
    const input = frames(['C4', 'C4', 'C4', 'C4']);
    const events = segmentNotes(input, 10, 0);
    expect(events).toEqual([{ note: 'C4', startMs: 0, durationMs: 40 }]);
  });

  it('splits on a note change and on a null gap', () => {
    const input = frames(['C4', 'C4', null, 'E4', 'E4', 'E4']);
    const events = segmentNotes(input, 10, 0);
    expect(events).toEqual([
      { note: 'C4', startMs: 0, durationMs: 20 },
      { note: 'E4', startMs: 30, durationMs: 30 },
    ]);
  });

  it('drops events shorter than the minimum note duration', () => {
    // a single stray frame between two silent stretches
    const input = frames([null, null, 'F#4', null, null]);
    const events = segmentNotes(input, 10, 50);
    expect(events).toEqual([]);
  });

  it('keeps events at or above the minimum note duration', () => {
    const input = frames([null, 'G4', 'G4', 'G4', 'G4', 'G4', null]);
    const events = segmentNotes(input, 10, 50);
    expect(events).toEqual([{ note: 'G4', startMs: 10, durationMs: 50 }]);
  });
});
