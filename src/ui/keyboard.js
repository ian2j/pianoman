import { computeKeyboardLayout } from '../music/notes.js';

const WHITE_KEY_WIDTH = 44;
const WHITE_KEY_HEIGHT = 160;
const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.62;
const BLACK_KEY_HEIGHT = WHITE_KEY_HEIGHT * 0.6;
const SVG_NS = 'http://www.w3.org/2000/svg';

function makeRect(x, y, w, h, midi, className) {
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.dataset.midi = String(midi);
  rect.classList.add('key', className);
  return rect;
}

function makeLabel(x, y, text, className) {
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('x', x);
  label.setAttribute('y', y);
  label.setAttribute('text-anchor', 'middle');
  label.classList.add('key-label', className);
  label.textContent = text;
  return label;
}

// Reusable piano keyboard, shared by every mode. Rendering position math
// comes from notes.js's computeKeyboardLayout (midi-indexed, not the
// hand-tuned offset table the v1 prototype used).
export function createKeyboard(container, { startMidi, endMidi, labels = {} } = {}) {
  const layout = computeKeyboardLayout(startMidi, endMidi);
  const width = layout.totalWhiteKeys * WHITE_KEY_WIDTH;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${WHITE_KEY_HEIGHT}`);
  svg.classList.add('keyboard');

  const keyElements = new Map();

  for (const key of layout.whiteKeys) {
    const x = key.index * WHITE_KEY_WIDTH;
    const rect = makeRect(x, 0, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT, key.midi, 'key-white');
    svg.appendChild(rect);
    keyElements.set(key.midi, rect);

    if (labels[key.midi]) {
      svg.appendChild(makeLabel(x + WHITE_KEY_WIDTH / 2, WHITE_KEY_HEIGHT - 10, labels[key.midi], 'key-label-white'));
    }
  }

  for (const key of layout.blackKeys) {
    const x = key.xIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
    const rect = makeRect(x, 0, BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT, key.midi, 'key-black');
    svg.appendChild(rect);
    keyElements.set(key.midi, rect);

    if (labels[key.midi]) {
      svg.appendChild(makeLabel(x + BLACK_KEY_WIDTH / 2, BLACK_KEY_HEIGHT - 8, labels[key.midi], 'key-label-black'));
    }
  }

  container.replaceChildren(svg);

  let clickHandler = null;
  svg.addEventListener('pointerdown', (event) => {
    const midiAttr = event.target?.dataset?.midi;
    if (midiAttr !== undefined && clickHandler) {
      clickHandler(Number(midiAttr));
    }
  });

  function setActiveNote(midi) {
    for (const rect of keyElements.values()) {
      rect.classList.remove('key-active');
    }
    if (midi !== null && midi !== undefined && keyElements.has(midi)) {
      keyElements.get(midi).classList.add('key-active');
    }
  }

  function setPressed(midiSet) {
    for (const [midi, rect] of keyElements) {
      rect.classList.toggle('key-pressed', midiSet.has(midi));
    }
  }

  return {
    element: svg,
    layout,
    setActiveNote,
    setPressed,
    onKeyClick(callback) {
      clickHandler = callback;
    },
    destroy() {
      container.replaceChildren();
    },
  };
}
