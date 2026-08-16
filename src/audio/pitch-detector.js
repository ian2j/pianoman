import { PitchDetector } from 'pitchy';
import { frequencyToNote, noteNameToMidi } from '../music/notes.js';

// Below this clarity (0-1, pitchy's confidence measure), treat the frame as
// unvoiced noise rather than a sung pitch.
const MIN_CLARITY = 0.9;
// Silence gate on RMS amplitude, ported from the volume < 0.01 check the
// Python prototypes used to skip processing near-silent frames.
const MIN_RMS = 0.01;

// Smooths raw per-frame pitch detections into a stable note using a
// dominant-note vote over a short rolling history, ported from the
// note_history/counts logic in test_get_note_v3/v4.py which was needed to
// stop the displayed note from flickering between neighboring pitches.
export class VoicePitchTracker {
  constructor({ historyLength = 6 } = {}) {
    this.historyLength = historyLength;
    this.history = [];
    this.detector = null;
    this.detectorFrameSize = 0;
  }

  processFrame(frame, sampleRate) {
    if (this.detectorFrameSize !== frame.length) {
      this.detector = PitchDetector.forFloat32Array(frame.length);
      this.detectorFrameSize = frame.length;
    }

    let sumSquares = 0;
    for (let i = 0; i < frame.length; i++) {
      sumSquares += frame[i] * frame[i];
    }
    const rms = Math.sqrt(sumSquares / frame.length);
    if (rms < MIN_RMS) {
      return null;
    }

    const [freq, clarity] = this.detector.findPitch(frame, sampleRate);
    if (clarity < MIN_CLARITY || freq <= 0) {
      return null;
    }

    const { name, cents } = frequencyToNote(freq);

    this.history.push(name);
    if (this.history.length > this.historyLength) {
      this.history.shift();
    }

    const counts = new Map();
    for (const n of this.history) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    let dominant = name;
    let bestCount = -1;
    for (const [n, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        dominant = n;
      }
    }

    // midi/note reflect the smoothed dominant note (so the keyboard
    // highlight and displayed note name always agree); cents reflects the
    // latest raw frame, matching the Python prototypes' behavior.
    return { note: dominant, midi: noteNameToMidi(dominant), cents, freq };
  }

  reset() {
    this.history = [];
  }
}
