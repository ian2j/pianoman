import { onFrame } from '../audio/mic.js';
import { Synth } from '../audio/synth.js';
import { VoicePitchTracker } from '../audio/pitch-detector.js';
import { closeAudioContext } from '../audio/util.js';
import { midiToNoteName, noteNameToMidi } from '../music/notes.js';
import { createKeyboard } from '../ui/keyboard.js';
import { createTunerMeter } from '../ui/tuner-meter.js';

const RANGE_LOW = noteNameToMidi('C3');
const RANGE_HIGH = noteNameToMidi('C6');
const DEFAULT_LOW = noteNameToMidi('C4');
const DEFAULT_HIGH = noteNameToMidi('C5');

const MATCH_TOLERANCE_CENTS = 35;
const MATCH_HOLD_MS = 500;

// Ear-training loop that directly targets the "build a stronger sing<->key
// association" goal: the app plays a random target note, you sing it back,
// and live pitch detection confirms the match once you've held it steady.
export const singBackMode = {
  id: 'sing-back',
  label: 'Sing-Back Trainer',
  needsMic: true,
  mount(container) {
    container.classList.add('mode-sing-back');

    const intro = document.createElement('p');
    intro.classList.add('mode-intro');
    intro.textContent = 'Listen to the target note, then sing it back. Hold the pitch steady to lock it in.';

    const controls = document.createElement('div');
    controls.classList.add('sing-back-controls');

    const lowSelect = document.createElement('select');
    const highSelect = document.createElement('select');
    for (let midi = RANGE_LOW; midi <= RANGE_HIGH; midi++) {
      const name = midiToNoteName(midi);
      lowSelect.add(new Option(name, String(midi)));
      highSelect.add(new Option(name, String(midi)));
    }
    lowSelect.value = String(DEFAULT_LOW);
    highSelect.value = String(DEFAULT_HIGH);

    const rangeLabel = document.createElement('label');
    rangeLabel.classList.add('range-label');
    rangeLabel.append('Range: ', lowSelect, ' to ', highSelect);

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.textContent = 'Play target note';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = 'New note';

    controls.append(rangeLabel, playBtn, skipBtn);

    const targetDisplay = document.createElement('div');
    targetDisplay.classList.add('note-display');

    const feedback = document.createElement('div');
    feedback.classList.add('sing-back-feedback');

    const streakDisplay = document.createElement('div');
    streakDisplay.classList.add('streak-display');

    const meterHost = document.createElement('div');
    const tunerMeter = createTunerMeter(meterHost);

    const keyboardHost = document.createElement('div');
    keyboardHost.classList.add('keyboard-host');
    const keyboard = createKeyboard(keyboardHost, { startMidi: RANGE_LOW, endMidi: RANGE_HIGH });

    container.append(intro, controls, targetDisplay, feedback, streakDisplay, meterHost, keyboardHost);

    const audioContext = new AudioContext();
    const synth = new Synth(audioContext);
    const tracker = new VoicePitchTracker();

    let targetMidi = null;
    let streak = 0;
    let matchStartedAt = null;
    let solved = false;

    function currentRange() {
      const low = Number(lowSelect.value);
      const high = Number(highSelect.value);
      return low <= high ? [low, high] : [high, low];
    }

    function pickTarget() {
      const [low, high] = currentRange();
      targetMidi = low + Math.floor(Math.random() * (high - low + 1));
      solved = false;
      matchStartedAt = null;
      targetDisplay.textContent = midiToNoteName(targetMidi);
      feedback.textContent = '';
      keyboard.setActiveNote(null);
    }

    function playTarget() {
      if (targetMidi === null) {
        pickTarget();
      }
      synth.playMidi(targetMidi, { duration: 1 });
    }

    playBtn.addEventListener('click', playTarget);
    skipBtn.addEventListener('click', () => {
      streak = 0;
      streakDisplay.textContent = '';
      pickTarget();
    });
    lowSelect.addEventListener('change', pickTarget);
    highSelect.addEventListener('change', pickTarget);

    pickTarget();

    const unsubscribe = onFrame((frame, sampleRate) => {
      if (solved || targetMidi === null) {
        return;
      }
      const result = tracker.processFrame(frame, sampleRate);
      if (!result) {
        matchStartedAt = null;
        return;
      }

      keyboard.setActiveNote(result.midi);
      const centsFromTarget = (result.midi - targetMidi) * 100 + result.cents;

      if (Math.abs(centsFromTarget) <= MATCH_TOLERANCE_CENTS) {
        tunerMeter.setCents(centsFromTarget);
        if (matchStartedAt === null) {
          matchStartedAt = performance.now();
        }
        const held = performance.now() - matchStartedAt;
        feedback.textContent = `Locking in… ${Math.min(100, Math.round((held / MATCH_HOLD_MS) * 100))}%`;
        if (held >= MATCH_HOLD_MS) {
          solved = true;
          streak += 1;
          streakDisplay.textContent = `Streak: ${streak}`;
          feedback.textContent = `Matched ${midiToNoteName(targetMidi)}!`;
          window.setTimeout(pickTarget, 900);
        }
      } else {
        matchStartedAt = null;
        tunerMeter.setCents(null);
        feedback.textContent = centsFromTarget > 0 ? 'Sharp — sing a bit lower' : 'Flat — sing a bit higher';
      }
    });

    return {
      unmount() {
        unsubscribe();
        closeAudioContext(audioContext);
        keyboard.destroy();
      },
    };
  },
};
