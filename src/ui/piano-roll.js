import { isBlackKey, noteNameToMidi } from '../music/notes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ROW_HEIGHT = 6;
const MS_PER_PX = 8;

// Timeline visualization for a transcribed melody: one row per semitone
// (x = time, y = pitch), distinct from keyboard.js which only highlights a
// single active key and isn't suited to showing a whole timed sequence.
export function createPianoRoll(container, { notes, durationMs, startMidi, endMidi }) {
  const midiRange = endMidi - startMidi + 1;
  const height = midiRange * ROW_HEIGHT;
  const width = Math.max(200, durationMs / MS_PER_PX);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.classList.add('piano-roll');

  for (let midi = startMidi; midi <= endMidi; midi++) {
    const y = (endMidi - midi) * ROW_HEIGHT;
    const row = document.createElementNS(SVG_NS, 'rect');
    row.setAttribute('x', 0);
    row.setAttribute('y', y);
    row.setAttribute('width', width);
    row.setAttribute('height', ROW_HEIGHT);
    row.classList.add('roll-row', isBlackKey(midi) ? 'roll-row-black' : 'roll-row-white');
    svg.appendChild(row);
  }

  for (const event of notes) {
    const midi = noteNameToMidi(event.note);
    if (midi < startMidi || midi > endMidi) {
      continue;
    }
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', event.startMs / MS_PER_PX);
    rect.setAttribute('y', (endMidi - midi) * ROW_HEIGHT);
    rect.setAttribute('width', Math.max(1, event.durationMs / MS_PER_PX));
    rect.setAttribute('height', ROW_HEIGHT);
    rect.classList.add('roll-note');
    svg.appendChild(rect);
  }

  const playhead = document.createElementNS(SVG_NS, 'line');
  playhead.setAttribute('x1', 0);
  playhead.setAttribute('y1', 0);
  playhead.setAttribute('x2', 0);
  playhead.setAttribute('y2', height);
  playhead.classList.add('roll-playhead');
  svg.appendChild(playhead);

  const scrollHost = document.createElement('div');
  scrollHost.classList.add('piano-roll-scroll');
  scrollHost.appendChild(svg);
  container.replaceChildren(scrollHost);

  function setPlayheadMs(ms) {
    const x = ms / MS_PER_PX;
    playhead.setAttribute('x1', x);
    playhead.setAttribute('x2', x);
    scrollHost.scrollLeft = Math.max(0, x - scrollHost.clientWidth / 2);
  }

  return {
    element: scrollHost,
    setPlayheadMs,
    destroy() {
      container.replaceChildren();
    },
  };
}
