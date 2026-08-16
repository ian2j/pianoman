import { describe, expect, it } from 'vitest';
import {
  computeKeyboardLayout,
  frequencyToNote,
  isBlackKey,
  midiToFrequency,
  midiToNoteName,
  noteNameToMidi,
} from '../src/music/notes.js';

describe('note/midi/frequency conversions', () => {
  it('maps MIDI 60 to C4 and 440Hz to A4', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(noteNameToMidi('A4')).toBe(69);
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
  });

  it('round-trips note name -> midi -> note name', () => {
    for (const name of ['C2', 'C#3', 'G4', 'A#5', 'B6']) {
      expect(midiToNoteName(noteNameToMidi(name))).toBe(name);
    }
  });

  it('identifies black keys by pitch class', () => {
    expect(isBlackKey(noteNameToMidi('C4'))).toBe(false);
    expect(isBlackKey(noteNameToMidi('C#4'))).toBe(true);
    expect(isBlackKey(noteNameToMidi('E4'))).toBe(false);
    expect(isBlackKey(noteNameToMidi('A#4'))).toBe(true);
  });

  it('finds the nearest note and cents offset for a frequency', () => {
    const inTune = frequencyToNote(440);
    expect(inTune.name).toBe('A4');
    expect(inTune.cents).toBeCloseTo(0, 3);

    // ~10 cents sharp of A4
    const sharp = frequencyToNote(440 * Math.pow(2, 10 / 1200));
    expect(sharp.name).toBe('A4');
    expect(sharp.cents).toBeCloseTo(10, 1);

    // just below the boundary should snap to G#4, not A4
    const flat = frequencyToNote(440 * Math.pow(2, -60 / 1200));
    expect(flat.name).toBe('G#4');
    expect(flat.cents).toBeCloseTo(40, 1);
  });
});

describe('computeKeyboardLayout', () => {
  it('lays out a single octave C4-B4 as 7 white keys with correctly placed black keys', () => {
    const layout = computeKeyboardLayout(noteNameToMidi('C4'), noteNameToMidi('B4'));

    expect(layout.totalWhiteKeys).toBe(7);
    expect(layout.whiteKeys.map((k) => k.name)).toEqual([
      'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    ]);

    // 5 black keys in an octave, none after B (no B#) or after E (no E#)
    expect(layout.blackKeys.map((k) => k.name)).toEqual([
      'C#4', 'D#4', 'F#4', 'G#4', 'A#4',
    ]);

    const cSharp = layout.blackKeys.find((k) => k.name === 'C#4');
    expect(cSharp.xIndex).toBeCloseTo(0.65, 5);
  });

  it('omits black keys whose white neighbor falls outside the range', () => {
    // Range starting exactly on C#4 has no white key to its left in range.
    const layout = computeKeyboardLayout(noteNameToMidi('C#4'), noteNameToMidi('D4'));
    expect(layout.blackKeys.map((k) => k.name)).toEqual([]);
    expect(layout.whiteKeys.map((k) => k.name)).toEqual(['D4']);
  });

  it('handles a multi-octave range spanning the prototypes default C2-C6', () => {
    const layout = computeKeyboardLayout(noteNameToMidi('C2'), noteNameToMidi('C6'));
    // 4 full octaves (C2..B5) + trailing C6 = 4*7 + 1 white keys
    expect(layout.totalWhiteKeys).toBe(29);
    expect(layout.whiteKeys[0].name).toBe('C2');
    expect(layout.whiteKeys[layout.whiteKeys.length - 1].name).toBe('C6');
  });

  it('throws when the range is inverted', () => {
    expect(() => computeKeyboardLayout(noteNameToMidi('C5'), noteNameToMidi('C4'))).toThrow();
  });
});
