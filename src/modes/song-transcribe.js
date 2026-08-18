import { transcribeAudioBuffer } from '../audio/song-transcriber.js';
import { closeAudioContext } from '../audio/util.js';
import { noteNameToMidi } from '../music/notes.js';
import { saveCustomMelody } from '../music/melody-store.js';
import { createKeyboard } from '../ui/keyboard.js';
import { createPianoRoll } from '../ui/piano-roll.js';

const RANGE_PADDING_SEMITONES = 2;
const MIN_MIDI = 21; // A0
const MAX_MIDI = 108; // C8

// Upload a local audio/video file and get a rough melody transcription back
// (pitch-detection over the decoded audio, offline — see
// audio/song-transcriber.js for the algorithm and its accuracy caveats).
// Doesn't need the mic, so it works regardless of mic permission issues.
export const songTranscribeMode = {
  id: 'song-transcribe',
  label: 'Song Transcribe',
  needsMic: false,
  mount(container) {
    container.classList.add('mode-song-transcribe');

    const intro = document.createElement('p');
    intro.classList.add('mode-intro');
    intro.textContent =
      "Upload a local audio or video file (e.g. something you've downloaded) and I'll pull out " +
      'a rough melody you can practice. Works best on solo vocals or a single instrument — full ' +
      'band mixes will come out noisier.';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*,video/*';

    const status = document.createElement('div');
    status.classList.add('transcribe-status');

    const resultHost = document.createElement('div');
    resultHost.classList.add('transcribe-result');
    resultHost.hidden = true;

    container.append(intro, fileInput, status, resultHost);

    let cleanupPlayback = () => {};

    async function handleFile(file) {
      cleanupPlayback();
      resultHost.hidden = true;
      resultHost.replaceChildren();
      status.textContent = 'Decoding audio…';

      let audioBuffer;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const decodeContext = new AudioContext();
        audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
        closeAudioContext(decodeContext);
      } catch (err) {
        status.textContent = `Couldn't decode this file (${err.message}). Try an mp3 or wav.`;
        return;
      }

      status.textContent = 'Analyzing… 0%';
      let result;
      try {
        result = await transcribeAudioBuffer(audioBuffer, {
          onProgress: (p) => {
            status.textContent = `Analyzing… ${Math.round(p * 100)}%`;
          },
        });
      } catch (err) {
        status.textContent = `Analysis failed: ${err.message}`;
        return;
      }

      if (result.notes.length === 0) {
        status.textContent = "Couldn't find a clear melody in this file — try a cleaner solo recording.";
        return;
      }

      status.textContent = `Found ${result.notes.length} notes.`;
      cleanupPlayback = renderResult(file, result);
    }

    function renderResult(file, result) {
      resultHost.hidden = false;

      const midis = result.notes.map((n) => noteNameToMidi(n.note));
      const startMidi = Math.max(MIN_MIDI, Math.min(...midis) - RANGE_PADDING_SEMITONES);
      const endMidi = Math.min(MAX_MIDI, Math.max(...midis) + RANGE_PADDING_SEMITONES);

      const controls = document.createElement('div');
      controls.classList.add('transcribe-controls');

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.textContent = 'Play';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.classList.add('transcribe-name-input');
      nameInput.placeholder = 'Name this melody…';
      nameInput.value = file.name.replace(/\.[^.]+$/, '');

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save to Melody Follow';

      const saveStatus = document.createElement('span');
      saveStatus.classList.add('transcribe-save-status');

      controls.append(playBtn, nameInput, saveBtn, saveStatus);

      const rollHost = document.createElement('div');
      const keyboardHost = document.createElement('div');
      keyboardHost.classList.add('keyboard-host');

      resultHost.append(controls, rollHost, keyboardHost);

      const pianoRoll = createPianoRoll(rollHost, {
        notes: result.notes,
        durationMs: result.durationMs,
        startMidi,
        endMidi,
      });
      const keyboard = createKeyboard(keyboardHost, { startMidi, endMidi });

      const objectUrl = URL.createObjectURL(file);
      const audioEl = new Audio(objectUrl);
      let rafId = null;

      function tick() {
        const ms = audioEl.currentTime * 1000;
        pianoRoll.setPlayheadMs(ms);
        const active = result.notes.find((n) => ms >= n.startMs && ms < n.startMs + n.durationMs);
        keyboard.setActiveNote(active ? noteNameToMidi(active.note) : null);
        rafId = requestAnimationFrame(tick);
      }

      playBtn.addEventListener('click', () => {
        if (audioEl.paused) {
          audioEl.play();
        } else {
          audioEl.pause();
        }
      });
      audioEl.addEventListener('play', () => {
        playBtn.textContent = 'Pause';
        rafId = requestAnimationFrame(tick);
      });
      audioEl.addEventListener('pause', () => {
        playBtn.textContent = 'Play';
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      });

      saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim() || 'Untitled Song';
        saveCustomMelody({ name, notes: result.notes, durationMs: result.durationMs });
        saveStatus.textContent = 'Saved — check Melody Follow.';
      });

      return () => {
        audioEl.pause();
        audioEl.src = '';
        URL.revokeObjectURL(objectUrl);
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        keyboard.destroy();
        pianoRoll.destroy();
      };
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        handleFile(file);
      }
    });

    return {
      unmount() {
        cleanupPlayback();
      },
    };
  },
};
