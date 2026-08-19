// Note <-> MIDI <-> frequency conversions and keyboard layout math.
// MIDI 60 = C4 (scientific pitch notation, matches the librosa convention
// the original prototypes relied on).

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

export function pitchClassName(midi) {
  return PITCH_CLASSES[((midi % 12) + 12) % 12];
}

export function isBlackKey(midi) {
  return pitchClassName(midi).includes('#');
}

export function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `${pitchClassName(midi)}${octave}`;
}

export function noteNameToMidi(noteName) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(noteName);
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }
  const [, pitchClass, octaveStr] = match;
  const pitchIndex = PITCH_CLASSES.indexOf(pitchClass);
  if (pitchIndex === -1) {
    throw new Error(`Invalid note name: ${noteName}`);
  }
  return (parseInt(octaveStr, 10) + 1) * 12 + pitchIndex;
}

export function noteNameToFrequency(noteName) {
  return midiToFrequency(noteNameToMidi(noteName));
}

export function transposeNoteName(noteName, semitones) {
  return midiToNoteName(noteNameToMidi(noteName) + semitones);
}

// Given a detected frequency, find the nearest note and how far off (in
// cents) the frequency is from that note's ideal pitch.
export function frequencyToNote(freq) {
  const exactMidi = frequencyToMidi(freq);
  const midi = Math.round(exactMidi);
  const cents = (exactMidi - midi) * 100;
  return { midi, name: midiToNoteName(midi), cents };
}

// Layout for drawing a piano keyboard spanning [startMidi, endMidi].
// Positions are expressed in units of "white key widths" so callers can
// scale by whatever pixel width they're rendering at. Black keys are only
// placed when their left white-key neighbor is within range, avoiding the
// hand-tuned offset table the early prototypes used (which broke for
// arbitrary ranges).
export function computeKeyboardLayout(startMidi, endMidi) {
  if (endMidi < startMidi) {
    throw new Error('endMidi must be >= startMidi');
  }

  const whiteKeys = [];
  const whiteIndexByMidi = new Map();

  for (let midi = startMidi; midi <= endMidi; midi++) {
    if (!isBlackKey(midi)) {
      const index = whiteKeys.length;
      whiteIndexByMidi.set(midi, index);
      whiteKeys.push({ midi, name: midiToNoteName(midi), index });
    }
  }

  const blackKeys = [];
  for (let midi = startMidi; midi <= endMidi; midi++) {
    if (isBlackKey(midi)) {
      const leftWhiteIndex = whiteIndexByMidi.get(midi - 1);
      if (leftWhiteIndex !== undefined) {
        blackKeys.push({ midi, name: midiToNoteName(midi), xIndex: leftWhiteIndex + 0.65 });
      }
    }
  }

  return { whiteKeys, blackKeys, totalWhiteKeys: whiteKeys.length };
}
