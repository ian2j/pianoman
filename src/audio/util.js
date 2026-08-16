// AudioContext.close() rejects with InvalidStateError if the context is
// already closed or closing; guard it so overlapping unmount/close calls
// (e.g. rapid mode switching) don't surface as an uncaught rejection.
export function closeAudioContext(audioContext) {
  if (audioContext && audioContext.state !== 'closed') {
    return audioContext.close().catch(() => {});
  }
  return Promise.resolve();
}
