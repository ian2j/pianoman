// Cents-offset needle meter, ported from draw_pitch_meter() in
// test_get_note_v3/v4.py (a centered track with a dot showing how sharp or
// flat the current pitch is, +/-50 cents full-scale).
export function createTunerMeter(container) {
  const wrap = document.createElement('div');
  wrap.classList.add('tuner-meter');

  const track = document.createElement('div');
  track.classList.add('tuner-track');

  const center = document.createElement('div');
  center.classList.add('tuner-center');

  const dot = document.createElement('div');
  dot.classList.add('tuner-dot');
  dot.style.display = 'none';

  track.append(center, dot);
  wrap.append(track);
  container.replaceChildren(wrap);

  function setCents(cents) {
    if (cents === null || cents === undefined || Number.isNaN(cents)) {
      dot.style.display = 'none';
      return;
    }
    dot.style.display = '';
    const clamped = Math.max(-50, Math.min(50, cents));
    dot.style.left = `${50 + (clamped / 50) * 50}%`;
    dot.classList.toggle('tuner-dot-in-tune', Math.abs(cents) < 8);
  }

  return { element: wrap, setCents };
}
