// Runs on the audio rendering thread. Buffers incoming mic samples into
// fixed-size frames and posts each completed frame to the main thread,
// where pitch-detector.js runs pitchy against it.
class PitchWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const frameSize = options?.processorOptions?.frameSize ?? 2048;
    this.buffer = new Float32Array(frameSize);
    this.writeIndex = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) {
      return true;
    }

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.writeIndex++] = channel[i];
      if (this.writeIndex === this.buffer.length) {
        this.port.postMessage(this.buffer.slice());
        this.writeIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pitch-worklet-processor', PitchWorkletProcessor);
