import { onFrame } from '../audio/mic.js';
import { Synth } from '../audio/synth.js';
import { VoicePitchTracker } from '../audio/pitch-detector.js';
import { closeAudioContext } from '../audio/util.js';
import { MELODIES } from '../music/melodies.js';
import { noteNameToMidi } from '../music/notes.js';
import { createKeyboard } from '../ui/keyboard.js';

const START_NOTE = 'C2';
const END_NOTE = 'C6';

// Extends test_visualize_piano.py's scripted melody demo into a scored
// follow-along game: the app plays/highlights each note in turn, and scores
// whether the dominant note you sang during that step matched.
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
    for (const melody of MELODIES) {
      melodySelect.add(new Option(melody.name, melody.id));
    }

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.textContent = 'Start';

    controls.append(melodySelect, startBtn);

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

    let running = false;
    let stepTimer = null;
    let sungCounts = new Map();
    let results = [];

    const unsubscribe = onFrame((frame, sampleRate) => {
      if (!running) {
        return;
      }
      const result = tracker.processFrame(frame, sampleRate);
      if (result) {
        sungCounts.set(result.note, (sungCounts.get(result.note) ?? 0) + 1);
      }
    });

    function renderProgress(melody, stepIndex) {
      progressDisplay.replaceChildren();
      melody.notes.forEach((note, i) => {
        const chip = document.createElement('span');
        chip.classList.add('melody-note-chip');
        chip.textContent = note;
        if (i < results.length) {
          chip.classList.add(results[i] ? 'chip-hit' : 'chip-miss');
        } else if (i === stepIndex) {
          chip.classList.add('chip-current');
        }
        progressDisplay.appendChild(chip);
      });
    }

    function finish(melody) {
      running = false;
      keyboard.setActiveNote(null);
      // No note is "current" anymore, so this only recolors the final
      // step's chip to hit/miss — without it, the last note stays stuck
      // showing its "current" highlight instead of its result.
      renderProgress(melody, -1);
      const hits = results.filter(Boolean).length;
      resultDisplay.textContent = `Score: ${hits} / ${melody.notes.length} notes matched`;
      startBtn.disabled = false;
      startBtn.textContent = 'Start';
    }

    function step(melody, index) {
      if (index >= melody.notes.length) {
        finish(melody);
        return;
      }

      const noteName = melody.notes[index];
      const midi = noteNameToMidi(noteName);
      keyboard.setActiveNote(midi);
      synth.playMidi(midi, { duration: (melody.tempoMs / 1000) * 0.85 });
      sungCounts = new Map();
      renderProgress(melody, index);

      stepTimer = window.setTimeout(() => {
        let sungDominant = null;
        let best = -1;
        for (const [note, count] of sungCounts) {
          if (count > best) {
            best = count;
            sungDominant = note;
          }
        }
        results.push(sungDominant === noteName);
        step(melody, index + 1);
      }, melody.tempoMs);
    }

    startBtn.addEventListener('click', () => {
      if (running) {
        return;
      }
      const melody = MELODIES.find((m) => m.id === melodySelect.value) ?? MELODIES[0];
      running = true;
      results = [];
      resultDisplay.textContent = '';
      startBtn.disabled = true;
      startBtn.textContent = 'Running…';
      step(melody, 0);
    });

    return {
      unmount() {
        running = false;
        if (stepTimer !== null) {
          window.clearTimeout(stepTimer);
        }
        unsubscribe();
        closeAudioContext(audioContext);
        keyboard.destroy();
      },
    };
  },
};
