// localStorage-backed custom melodies (e.g. saved from Song Transcribe).
// There's no backend in this app, so localStorage is the only persistence
// option; melodies are small (a note list), well within storage limits.
const STORAGE_KEY = 'pianoman.customMelodies.v1';

export function loadCustomMelodies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(melodies) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(melodies));
}

export function saveCustomMelody({ name, notes, durationMs }) {
  const melodies = loadCustomMelodies();
  const melody = {
    id: `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    source: 'custom',
    notes,
    durationMs,
  };
  melodies.push(melody);
  writeAll(melodies);
  return melody;
}

export function deleteCustomMelody(id) {
  writeAll(loadCustomMelodies().filter((m) => m.id !== id));
}
