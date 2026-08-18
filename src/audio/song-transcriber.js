import { PitchDetector } from 'pitchy';
import { frequencyToNote } from '../music/notes.js';

// Offline counterpart to pitch-detector.js's VoicePitchTracker: instead of
// streaming live mic frames, this walks a whole decoded song and produces a
// note-event transcription. pitchy (like the YIN-family algorithms in the
// original pygame prototypes) is built for monophonic sources, so a full
// band mix will be noisier than a solo vocal/instrument recording — the
// bandpass filter and note-duration cleanup below are mitigations, not a
// fix for that fundamental limitation.
const ANALYSIS_SAMPLE_RATE = 11025;
const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const HIGHPASS_HZ = 90;
const LOWPASS_HZ = 1500;
const MIN_CLARITY = 0.85;
const MIN_RMS = 0.008;
const SMOOTH_WINDOW = 5;
const MIN_NOTE_MS = 150;
const YIELD_EVERY_N_FRAMES = 200;

export async function transcribeAudioBuffer(audioBuffer, { onProgress } = {}) {
  const filtered = await renderFilteredMono(audioBuffer);
  const samples = filtered.getChannelData(0);
  const sampleRate = filtered.sampleRate;
  const hopMs = (HOP_SIZE / sampleRate) * 1000;

  const rawFrames = [];
  const detector = PitchDetector.forFloat32Array(FRAME_SIZE);
  const totalFrames = Math.max(1, Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE));

  let frameIndex = 0;
  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    const frame = samples.subarray(start, start + FRAME_SIZE);
    const timeMs = (start / sampleRate) * 1000;
    rawFrames.push(analyzeFrame(frame, sampleRate, detector, timeMs));

    frameIndex += 1;
    if (frameIndex % YIELD_EVERY_N_FRAMES === 0) {
      onProgress?.(Math.min(1, frameIndex / totalFrames));
      await yieldToUI();
    }
  }
  onProgress?.(1);

  const smoothed = smoothFrames(rawFrames);
  const notes = segmentNotes(smoothed, hopMs);

  return { notes, durationMs: audioBuffer.duration * 1000 };
}

function analyzeFrame(frame, sampleRate, detector, timeMs) {
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i++) {
    sumSquares += frame[i] * frame[i];
  }
  const rms = Math.sqrt(sumSquares / frame.length);
  if (rms < MIN_RMS) {
    return { timeMs, note: null };
  }

  const [freq, clarity] = detector.findPitch(frame, sampleRate);
  if (clarity < MIN_CLARITY || freq <= 0) {
    return { timeMs, note: null };
  }

  return { timeMs, note: frequencyToNote(freq).name };
}

// Windowed dominant-note vote per frame — the batch equivalent of
// VoicePitchTracker's rolling history voting, applied to the whole
// pre-computed frame array instead of a live stream.
export function smoothFrames(frames, windowSize = SMOOTH_WINDOW) {
  return frames.map((frame, i) => {
    const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
    const windowEnd = Math.min(frames.length, windowStart + windowSize);

    const counts = new Map();
    for (let j = windowStart; j < windowEnd; j++) {
      const { note } = frames[j];
      if (note) {
        counts.set(note, (counts.get(note) ?? 0) + 1);
      }
    }

    let dominant = null;
    let best = 0;
    for (const [note, count] of counts) {
      if (count > best) {
        best = count;
        dominant = note;
      }
    }

    return { timeMs: frame.timeMs, note: dominant };
  });
}

// Merges consecutive same-note frames into note events and drops anything
// shorter than MIN_NOTE_MS as noise (a single flickered frame, not a note).
export function segmentNotes(frames, hopMs, minNoteMs = MIN_NOTE_MS) {
  const events = [];
  let current = null;

  for (const frame of frames) {
    if (current && frame.note === current.note) {
      current.durationMs = frame.timeMs + hopMs - current.startMs;
      continue;
    }

    if (current && current.durationMs >= minNoteMs) {
      events.push(current);
    }
    current = frame.note ? { note: frame.note, startMs: frame.timeMs, durationMs: hopMs } : null;
  }

  if (current && current.durationMs >= minNoteMs) {
    events.push(current);
  }

  return events;
}

async function renderFilteredMono(audioBuffer) {
  const length = Math.max(1, Math.ceil(audioBuffer.duration * ANALYSIS_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(1, length, ANALYSIS_SAMPLE_RATE);

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = HIGHPASS_HZ;

  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = LOWPASS_HZ;

  source.connect(highpass).connect(lowpass).connect(offlineCtx.destination);
  source.start(0);

  return offlineCtx.startRendering();
}

function yieldToUI() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
