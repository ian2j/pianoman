import { closeAudioContext } from './util.js';

// Shared mic capture pipeline: one AudioContext + AudioWorkletNode for the
// whole app, so multiple modes can subscribe to frames without each opening
// their own getUserMedia stream. Must be started from a user gesture.
const FRAME_SIZE = 2048;

let audioContext = null;
let workletNode = null;
let mediaStream = null;
let sourceNode = null;
let startPromise = null;
const listeners = new Set();

export function onFrame(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function isMicActive() {
  return workletNode !== null;
}

export async function startMic() {
  if (workletNode) {
    return { sampleRate: audioContext.sampleRate };
  }
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule(new URL('./pitch-worklet.js', import.meta.url));

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(audioContext, 'pitch-worklet-processor', {
      processorOptions: { frameSize: FRAME_SIZE },
    });
    workletNode.port.onmessage = (event) => {
      for (const listener of listeners) {
        listener(event.data, audioContext.sampleRate);
      }
    };

    sourceNode.connect(workletNode);
    // The worklet never writes to its output, so this stays silent; it just
    // keeps the node connected to an active destination so process() keeps
    // being called.
    workletNode.connect(audioContext.destination);

    return { sampleRate: audioContext.sampleRate };
  })();

  try {
    return await startPromise;
  } finally {
    startPromise = null;
  }
}

export function stopMic() {
  sourceNode?.disconnect();
  workletNode?.disconnect();
  mediaStream?.getTracks().forEach((track) => track.stop());
  closeAudioContext(audioContext);

  audioContext = null;
  workletNode = null;
  mediaStream = null;
  sourceNode = null;
}
