import { onFrame } from '../audio/mic.js';
import { VoicePitchTracker } from '../audio/pitch-detector.js';
import { noteNameToMidi } from '../music/notes.js';
import { createKeyboard } from '../ui/keyboard.js';
import { createTunerMeter } from '../ui/tuner-meter.js';

const START_NOTE = 'C2';
const END_NOTE = 'C6';

// The core "sing and see it light up" mode, ported from
// test_get_note_v4.py: live mic pitch detection highlights the matching key
// and shows a cents tuning meter.
export const pitchMirrorMode = {
  id: 'pitch-mirror',
  label: 'Pitch Mirror',
  needsMic: true,
  mount(container) {
    container.classList.add('mode-pitch-mirror');

    const intro = document.createElement('p');
    intro.classList.add('mode-intro');
    intro.textContent = 'Sing or hum a note — the matching key lights up in real time.';

    const noteDisplay = document.createElement('div');
    noteDisplay.classList.add('note-display');
    noteDisplay.textContent = '—';

    const meterHost = document.createElement('div');
    const tunerMeter = createTunerMeter(meterHost);

    const keyboardHost = document.createElement('div');
    keyboardHost.classList.add('keyboard-host');
    const keyboard = createKeyboard(keyboardHost, {
      startMidi: noteNameToMidi(START_NOTE),
      endMidi: noteNameToMidi(END_NOTE),
    });

    container.append(intro, noteDisplay, meterHost, keyboardHost);

    const tracker = new VoicePitchTracker();
    const unsubscribe = onFrame((frame, sampleRate) => {
      const result = tracker.processFrame(frame, sampleRate);
      if (result) {
        noteDisplay.textContent = result.note;
        tunerMeter.setCents(result.cents);
        keyboard.setActiveNote(result.midi);
      } else {
        noteDisplay.textContent = '—';
        tunerMeter.setCents(null);
        keyboard.setActiveNote(null);
      }
    });

    return {
      unmount() {
        unsubscribe();
        keyboard.destroy();
      },
    };
  },
};
