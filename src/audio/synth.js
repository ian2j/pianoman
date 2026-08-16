import { midiToFrequency, noteNameToFrequency } from '../music/notes.js';

// Ported from test_practice_piano.py's generate_sound: 4 harmonics, an ADSR
// envelope, a short noise "hammer" transient, and slight left/right detune
// for stereo richness. Rebuilt with live Web Audio nodes instead of
// pre-rendering a buffer, since we don't know note durations up front here.
const HARMONIC_GAINS = [1.0, 0.5, 0.25, 0.1];
const DETUNE = 0.003;
const NOISE_DURATION = 0.005;
const NOISE_GAIN = 0.02;

const ATTACK = 0.01;
const DECAY = 0.15;
const SUSTAIN_LEVEL = 0.5;
const RELEASE = 0.4;

function scheduleEnvelope(gainParam, now, duration) {
  gainParam.setValueAtTime(0, now);
  gainParam.linearRampToValueAtTime(1, now + ATTACK);
  gainParam.linearRampToValueAtTime(SUSTAIN_LEVEL, now + ATTACK + DECAY);
  const releaseStart = Math.max(now + ATTACK + DECAY, now + duration - RELEASE);
  gainParam.setValueAtTime(SUSTAIN_LEVEL, releaseStart);
  gainParam.linearRampToValueAtTime(0.0001, releaseStart + RELEASE);
  return releaseStart + RELEASE;
}

export class Synth {
  constructor(audioContext) {
    this.context = audioContext;
    this.master = audioContext.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(audioContext.destination);
  }

  playFrequency(frequency, { duration = 1.2 } = {}) {
    const ctx = this.context;
    const now = ctx.currentTime;

    const merger = ctx.createChannelMerger(2);
    merger.connect(this.master);

    const oscillators = [];
    const sides = [
      { mergerInput: 0, detune: 0 },
      { mergerInput: 1, detune: DETUNE },
    ];

    let stopAt = now + duration;

    for (const side of sides) {
      const channelGain = ctx.createGain();
      const releaseEnd = scheduleEnvelope(channelGain.gain, now, duration);
      stopAt = Math.max(stopAt, releaseEnd);
      channelGain.connect(merger, 0, side.mergerInput);

      const freq = frequency * (1 + side.detune);
      HARMONIC_GAINS.forEach((gain, harmonicIndex) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * (harmonicIndex + 1);

        const harmonicGain = ctx.createGain();
        harmonicGain.gain.value = gain;

        osc.connect(harmonicGain).connect(channelGain);
        osc.start(now);
        oscillators.push(osc);
      });
    }

    // Short hammer-like noise transient, mixed lightly into both channels.
    const noiseBuffer = ctx.createBuffer(1, Math.round(NOISE_DURATION * ctx.sampleRate), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = NOISE_GAIN;
    noiseSource.connect(noiseGain);
    noiseGain.connect(merger, 0, 0);
    noiseGain.connect(merger, 0, 1);
    noiseSource.start(now);

    for (const osc of oscillators) {
      osc.stop(stopAt + 0.05);
    }

    return {
      stop: () => {
        const releaseNow = ctx.currentTime;
        for (const osc of oscillators) {
          try {
            osc.stop(releaseNow + 0.05);
          } catch {
            // already scheduled to stop
          }
        }
      },
    };
  }

  playMidi(midi, opts) {
    return this.playFrequency(midiToFrequency(midi), opts);
  }

  playNoteName(noteName, opts) {
    return this.playFrequency(noteNameToFrequency(noteName), opts);
  }
}
