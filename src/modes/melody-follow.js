import { onFrame } from '../audio/mic.js';
import { Synth } from '../audio/synth.js';
import { VoicePitchTracker } from '../audio/pitch-detector.js';
import { closeAudioContext } from '../audio/util.js';
import { MELODIES } from '../music/melodies.js';
import { deleteCustomMelody, loadCustomMelodies } from '../music/melody-store.js';
import { noteNameToMidi, transposeNoteName } from '../music/notes.js';
import { createKeyboard } from '../ui/keyboard.js';

const MIN_MIDI = 21; // A0
const MAX_MIDI = 108; // C8
const RANGE_PADDING_SEMITONES = 2;
const MAX_OCTAVE_SHIFT = 4;

function transposeMelody(melody, octaveShift) {
  if (octaveShift === 0) {
    return melody;
  }
  const semitones = octaveShift * 12;
  return {
    ...melody,
    notes: melody.notes.map((n) => ({ ...n, note: transposeNoteName(n.note, semitones) })),
  };
}

function formatOctaveLabel(octaveShift) {
  if (octaveShift === 0) {
    return 'Octave: 0';
  }
  return `Octave: ${octaveShift > 0 ? '+' : ''}${octaveShift}`;
}

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

    const octaveControls = document.createElement('div');
    octaveControls.classList.add('octave-controls');

    const octaveDownBtn = document.createElement('button');
    octaveDownBtn.type = 'button';
    octaveDownBtn.textContent = '▼ Octave';

    const octaveLabel = document.createElement('span');
    octaveLabel.classList.add('octave-label');

    const octaveUpBtn = document.createElement('button');
    octaveUpBtn.type = 'button';
    octaveUpBtn.textContent = '▲ Octave';

    octaveControls.append(octaveDownBtn, octaveLabel, octaveUpBtn);

    const progressDisplay = document.createElement('div');
    progressDisplay.classList.add('melody-progress');

    const resultDisplay = document.createElement('div');
    resultDisplay.classList.add('melody-result');

    const keyboardHost = document.createElement('div');
    keyboardHost.classList.add('keyboard-host');
    let keyboard = null;

    container.append(intro, controls, octaveControls, progressDisplay, resultDisplay, keyboardHost);

    const audioContext = new AudioContext();
    const synth = new Synth(audioContext);
    const tracker = new VoicePitchTracker();

    let availableMelodies = [];
    let octaveShift = 0;
    let running = false;
    let activeTimers = [];
    let sungCountsPerNote = [];
    let results = [];
    let currentNoteIndex = -1;

    function currentMelody() {
      return availableMelodies.find((m) => m.id === melodySelect.value) ?? null;
    }

    function updateDeleteButtonVisibility() {
      const melody = currentMelody();
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

    function rebuildKeyboard(melody) {
      keyboard?.destroy();
      const midis = melody.notes.map((n) => noteNameToMidi(n.note));
      const startMidi = Math.max(MIN_MIDI, Math.min(...midis) - RANGE_PADDING_SEMITONES);
      const endMidi = Math.min(MAX_MIDI, Math.max(...midis) + RANGE_PADDING_SEMITONES);
      keyboard = createKeyboard(keyboardHost, { startMidi, endMidi });
    }

    function updateOctaveButtons() {
      octaveDownBtn.disabled = running || octaveShift <= -MAX_OCTAVE_SHIFT;
      octaveUpBtn.disabled = running || octaveShift >= MAX_OCTAVE_SHIFT;
    }

    // Refreshes the keyboard range and the (unstarted) progress chips to
    // reflect the currently selected melody and octave shift, so you can
    // see and adjust the register before hitting Start.
    function syncPreview() {
      octaveLabel.textContent = formatOctaveLabel(octaveShift);
      updateOctaveButtons();
      const melody = currentMelody();
      if (!melody) {
        return;
      }
      const shifted = transposeMelody(melody, octaveShift);
      rebuildKeyboard(shifted);
      results = new Array(shifted.notes.length).fill(null);
      renderProgress(shifted, -1);
    }

    availableMelodies = refreshMelodyOptions();
    updateDeleteButtonVisibility();
    syncPreview();

    melodySelect.addEventListener('change', () => {
      octaveShift = 0;
      updateDeleteButtonVisibility();
      syncPreview();
    });
    deleteBtn.addEventListener('click', () => {
      const melody = currentMelody();
      if (!melody || melody.source !== 'custom') {
        return;
      }
      deleteCustomMelody(melody.id);
      availableMelodies = refreshMelodyOptions();
      octaveShift = 0;
      updateDeleteButtonVisibility();
      syncPreview();
    });
    octaveDownBtn.addEventListener('click', () => {
      if (running || octaveShift <= -MAX_OCTAVE_SHIFT) {
        return;
      }
      octaveShift -= 1;
      syncPreview();
    });
    octaveUpBtn.addEventListener('click', () => {
      if (running || octaveShift >= MAX_OCTAVE_SHIFT) {
        return;
      }
      octaveShift += 1;
      syncPreview();
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
      updateOctaveButtons();
    }

    function run(melody) {
      results = new Array(melody.notes.length).fill(null);
      sungCountsPerNote = melody.notes.map(() => new Map());
      currentNoteIndex = -1;
      running = true;
      resultDisplay.textContent = '';
      startBtn.disabled = true;
      startBtn.textContent = 'Running…';
      updateOctaveButtons();
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
      const melody = currentMelody();
      if (!melody) {
        return;
      }
      stopTimers();
      const shifted = transposeMelody(melody, octaveShift);
      rebuildKeyboard(shifted);
      run(shifted);
    });

    return {
      unmount() {
        running = false;
        stopTimers();
        unsubscribe();
        closeAudioContext(audioContext);
        keyboard?.destroy();
      },
    };
  },
};
