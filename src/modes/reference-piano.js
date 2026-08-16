import { Synth } from '../audio/synth.js';
import { closeAudioContext } from '../audio/util.js';
import { noteNameToMidi } from '../music/notes.js';
import { createKeyboard } from '../ui/keyboard.js';

const START_NOTE = 'C4';
const END_NOTE = 'F#5';

// QWERTY-to-note mapping, ported from test_practice_piano.py's key_map but
// keyed by physical KeyboardEvent.code so it stays layout-independent.
const KEY_MAP = {
  KeyA: 'C4', KeyW: 'C#4', KeyS: 'D4', KeyE: 'D#4', KeyD: 'E4', KeyF: 'F4',
  KeyT: 'F#4', KeyG: 'G4', KeyY: 'G#4', KeyH: 'A4', KeyU: 'A#4', KeyJ: 'B4',
  KeyK: 'C5', KeyO: 'C#5', KeyL: 'D5', KeyP: 'D#5',
  Semicolon: 'E5', Quote: 'F5', BracketRight: 'F#5',
};

function labelForCode(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'Semicolon') return ';';
  if (code === 'Quote') return "'";
  if (code === 'BracketRight') return ']';
  return code;
}

const CODE_TO_MIDI = Object.fromEntries(
  Object.entries(KEY_MAP).map(([code, note]) => [code, noteNameToMidi(note)]),
);
const LABELS_BY_MIDI = Object.fromEntries(
  Object.entries(KEY_MAP).map(([code, note]) => [noteNameToMidi(note), labelForCode(code)]),
);

// Ground-truth reference synth you can click or play on the QWERTY rows, to
// compare against your own singing.
export const referencePianoMode = {
  id: 'reference-piano',
  label: 'Reference Piano',
  needsMic: false,
  mount(container) {
    container.classList.add('mode-reference-piano');

    const intro = document.createElement('p');
    intro.classList.add('mode-intro');
    intro.textContent = 'Click a key, or play the A-J and K-] rows on your keyboard, to hear the true pitch.';

    const keyboardHost = document.createElement('div');
    keyboardHost.classList.add('keyboard-host');
    const keyboard = createKeyboard(keyboardHost, {
      startMidi: noteNameToMidi(START_NOTE),
      endMidi: noteNameToMidi(END_NOTE),
      labels: LABELS_BY_MIDI,
    });

    container.append(intro, keyboardHost);

    const audioContext = new AudioContext();
    const synth = new Synth(audioContext);
    const pressed = new Set();
    const activeVoices = new Map();

    function noteOn(midi) {
      if (pressed.has(midi)) return;
      pressed.add(midi);
      keyboard.setPressed(pressed);
      activeVoices.set(midi, synth.playMidi(midi, { duration: 1.2 }));
    }

    function noteOff(midi) {
      pressed.delete(midi);
      keyboard.setPressed(pressed);
      activeVoices.get(midi)?.stop();
      activeVoices.delete(midi);
    }

    keyboard.onKeyClick((midi) => {
      noteOn(midi);
      window.setTimeout(() => noteOff(midi), 300);
    });

    function handleKeyDown(event) {
      const midi = CODE_TO_MIDI[event.code];
      if (midi !== undefined && !event.repeat) {
        noteOn(midi);
      }
    }
    function handleKeyUp(event) {
      const midi = CODE_TO_MIDI[event.code];
      if (midi !== undefined) {
        noteOff(midi);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return {
      unmount() {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        for (const midi of [...pressed]) {
          noteOff(midi);
        }
        closeAudioContext(audioContext);
        keyboard.destroy();
      },
    };
  },
};
