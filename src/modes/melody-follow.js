import { onFrame } from '../audio/mic.js';
import { Synth } from '../audio/synth.js';
import { VoicePitchTracker } from '../audio/pitch-detector.js';
import { closeAudioContext } from '../audio/util.js';
import { MELODIES } from '../music/melodies.js';
import { deleteCustomMelody, loadCustomMelodies } from '../music/melody-store.js';
import { noteNameToMidi } from '../music/notes.js';
import { createKeyboard } from '../ui/keyboard.js';

const START_NOTE = 'C2';
const END_NOTE = 'C6';

// Extends test_visualize_piano.py's scripted melody demo into a scored
// follow-along game: the app plays/highlights each note in turn, and scores
// whether the dominant note you sang during that step matched.
//
// Melodies carry per-note timing ({ note, startMs, durationMs }) rather
// than a fixed grid, so notes can have variable length and there can be
// rests between them (needed for melodies transcribed from real songs in
// Song Transcribe). Scheduling uses one absolute-offset setTimeout pair per
// note (start + end) instead of a relative recursive chain, so a rest is
// just the gap between one note's end timer and the next note's start
// timer — no note is "current" during it, and nothing gets scored.
export const melodyFollowMode = {
  id: 'melody-follow',
  label: 'Melody Follow',
  needsMic: true,
  mount(container) {
    container.classList.add('mode-melody-follow');

    const intro = document.createElement('p');
    intro.classList.add('mode-intro');
    intro.textContent = 'Pick a melody, hit Start, and sing along with the highlighted notes.';

    const controls = document.createElement('div');
    controls.classList.add('melody-controls');

    const melodySelect = document.createElement('select');

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.classList.add('melody-delete-btn');

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.textContent = 'Start';

    controls.append(melodySelect, deleteBtn, startBtn);

    const progressDisplay = document.createElement('div');
    progressDisplay.classList.add('melody-progress');

    const resultDisplay = document.createElement('div');
    resultDisplay.classList.add('melody-result');

    const keyboardHost = document.createElement('div');
    keyboardHost.classList.add('keyboard-host');
    const keyboard = createKeyboard(keyboardHost, {
      startMidi: noteNameToMidi(START_NOTE),
      endMidi: noteNameToMidi(END_NOTE),
    });

    container.append(intro, controls, progressDisplay, resultDisplay, keyboardHost);

    const audioContext = new AudioContext();
    const synth = new Synth(audioContext);
    const tracker = new VoicePitchTracker();

    let availableMelodies = [];
    let running = false;
    let activeTimers = [];
    let sungCountsPerNote = [];
    let results = [];
    let currentNoteIndex = -1;

    function updateDeleteButtonVisibility() {
      const melody = availableMelodies.find((m) => m.id === melodySelect.value);
      deleteBtn.hidden = !melody || melody.source !== 'custom';
    }

    function refreshMelodyOptions(preserveId) {
      const combined = [...MELODIES, ...loadCustomMelodies()];
      melodySelect.replaceChildren();
      for (const melody of combined) {
        melodySelect.add(new Option(melody.name, melody.id));
      }
      if (preserveId && combined.some((m) => m.id === preserveId)) {
        melodySelect.value = preserveId;
      }
      return combined;
    }

    availableMelodies = refreshMelodyOptions();
    updateDeleteButtonVisibility();

    melodySelect.addEventListener('change', updateDeleteButtonVisibility);
    deleteBtn.addEventListener('click', () => {
      const melody = availableMelodies.find((m) => m.id === melodySelect.value);
      if (!melody || melody.source !== 'custom') {
        return;
      }
      deleteCustomMelody(melody.id);
      availableMelodies = refreshMelodyOptions();
      updateDeleteButtonVisibility();
    });

    const unsubscribe = onFrame((frame, sampleRate) => {
      if (!running || currentNoteIndex < 0) {
        return;
      }
      const result = tracker.processFrame(frame, sampleRate);
      if (result) {
        const counts = sungCountsPerNote[currentNoteIndex];
        counts.set(result.note, (counts.get(result.note) ?? 0) + 1);
      }
    });

    function renderProgress(melody, currentIndex) {
      progressDisplay.replaceChildren();
      melody.notes.forEach((noteEvent, i) => {
        const chip = document.createElement('span');
        chip.classList.add('melody-note-chip');
        chip.textContent = noteEvent.note;
        if (results[i] !== null && results[i] !== undefined) {
          chip.classList.add(results[i] ? 'chip-hit' : 'chip-miss');
        } else if (i === currentIndex) {
          chip.classList.add('chip-current');
        }
        progressDisplay.appendChild(chip);
      });
    }

    function stopTimers() {
      for (const timer of activeTimers) {
        window.clearTimeout(timer);
      }
      activeTimers = [];
    }

    function finish(melody) {
      running = false;
      currentNoteIndex = -1;
      keyboard.setActiveNote(null);
      renderProgress(melody, -1);
      const hits = results.filter(Boolean).length;
      resultDisplay.textContent = `Score: ${hits} / ${melody.notes.length} notes matched`;
      startBtn.disabled = false;
      startBtn.textContent = 'Start';
    }

    function run(melody) {
      results = new Array(melody.notes.length).fill(null);
      sungCountsPerNote = melody.notes.map(() => new Map());
      currentNoteIndex = -1;
      running = true;
      resultDisplay.textContent = '';
      startBtn.disabled = true;
      startBtn.textContent = 'Running…';
      renderProgress(melody, -1);

      melody.notes.forEach((noteEvent, i) => {
        const midi = noteNameToMidi(noteEvent.note);

        const startTimer = window.setTimeout(() => {
          currentNoteIndex = i;
          keyboard.setActiveNote(midi);
          synth.playMidi(midi, { duration: noteEvent.durationMs / 1000 });
          renderProgress(melody, i);
        }, noteEvent.startMs);

        const endTimer = window.setTimeout(() => {
          const counts = sungCountsPerNote[i];
          let dominant = null;
          let best = -1;
          for (const [note, count] of counts) {
            if (count > best) {
              best = count;
              dominant = note;
            }
          }
          results[i] = dominant === noteEvent.note;
          if (currentNoteIndex === i) {
            currentNoteIndex = -1;
            keyboard.setActiveNote(null);
          }
          renderProgress(melody, currentNoteIndex);
        }, noteEvent.startMs + noteEvent.durationMs);

        activeTimers.push(startTimer, endTimer);
      });

      activeTimers.push(window.setTimeout(() => finish(melody), melody.durationMs + 100));
    }

    startBtn.addEventListener('click', () => {
      if (running) {
        return;
      }
      const melody = availableMelodies.find((m) => m.id === melodySelect.value) ?? availableMelodies[0];
      if (!melody) {
        return;
      }
      stopTimers();
      run(melody);
    });

    return {
      unmount() {
        running = false;
        stopTimers();
        unsubscribe();
        closeAudioContext(audioContext);
        keyboard.destroy();
      },
    };
  },
};
