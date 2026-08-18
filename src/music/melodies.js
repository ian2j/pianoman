// Built-in target melodies for Melody Follow mode. "Prototype Melody" is the
// hardcoded sequence from test_visualize_piano.py, kept as-is for
// continuity; the others are simple, well-known tunes that are easy to
// judge by ear while singing along.
//
// Melodies use a timed note-event format ({ note, startMs, durationMs })
// rather than a fixed grid, so they can represent variable-length notes and
// rests (needed for melodies transcribed from real songs). The built-ins
// below are defined as flat note lists at a fixed tempo for readability and
// expanded into that format at load time.

function expandFixedTempo(notes, tempoMs) {
  return notes.map((note, i) => ({ note, startMs: i * tempoMs, durationMs: tempoMs }));
}

function melodyDuration(notes) {
  const last = notes[notes.length - 1];
  return last.startMs + last.durationMs;
}

const BUILT_IN_MELODIES = [
  {
    id: 'prototype',
    name: 'Prototype Melody',
    tempoMs: 600,
    notes: [
      'C3', 'C3', 'G3', 'G3', 'A3', 'G#3', 'G3', 'F#3', 'E3',
      'C3', 'G3', 'G3', 'G3', 'F#3', 'E3', 'C3',
    ],
  },
  {
    id: 'twinkle',
    name: 'Twinkle Twinkle Little Star',
    tempoMs: 500,
    notes: [
      'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
      'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
    ],
  },
  {
    id: 'mary',
    name: 'Mary Had a Little Lamb',
    tempoMs: 450,
    notes: [
      'E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4',
      'D4', 'D4', 'D4', 'E4', 'G4', 'G4',
      'E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4', 'E4',
      'D4', 'D4', 'E4', 'D4', 'C4',
    ],
  },
];

export const MELODIES = BUILT_IN_MELODIES.map(({ id, name, tempoMs, notes }) => {
  const timedNotes = expandFixedTempo(notes, tempoMs);
  return { id, name, source: 'built-in', notes: timedNotes, durationMs: melodyDuration(timedNotes) };
});
