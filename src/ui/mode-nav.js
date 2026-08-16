import { startMic, stopMic } from '../audio/mic.js';

// Tab bar that mounts/unmounts mode modules and owns the shared mic
// lifecycle: it's only requested (a user-gesture-gated getUserMedia call)
// when switching into a mode that declares needsMic, and stopped when
// leaving it, so modes don't each manage their own stream.
export function createModeNav(container, modes) {
  const nav = document.createElement('div');
  nav.classList.add('mode-nav');

  const tabBar = document.createElement('div');
  tabBar.classList.add('mode-tabs');

  const micStatus = document.createElement('div');
  micStatus.classList.add('mic-status');

  const modeContainer = document.createElement('div');
  modeContainer.classList.add('mode-content');

  nav.append(tabBar, micStatus, modeContainer);
  container.replaceChildren(nav);

  const buttons = new Map();
  for (const mode of modes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = mode.label;
    btn.classList.add('mode-tab');
    btn.addEventListener('click', () => selectMode(mode.id));
    tabBar.appendChild(btn);
    buttons.set(mode.id, btn);
  }

  let activeMode = null;
  let activeInstance = null;
  // Bumped on every call so an in-flight startMic() from a superseded
  // transition (e.g. the user clicking two tabs before the first mic
  // request resolves) can tell it's stale and back off instead of
  // mounting/stopping mic state a newer transition already owns.
  let transitionId = 0;

  async function selectMode(id) {
    const mode = modes.find((m) => m.id === id);
    if (!mode || mode === activeMode) {
      return;
    }

    const myTransition = ++transitionId;

    activeInstance?.unmount?.();
    if (activeMode?.needsMic) {
      stopMic();
    }

    activeMode = mode;
    for (const [mid, btn] of buttons) {
      btn.classList.toggle('mode-tab-active', mid === id);
    }

    modeContainer.replaceChildren();
    micStatus.textContent = '';

    if (mode.needsMic) {
      micStatus.textContent = 'Requesting microphone…';
      try {
        await startMic();
      } catch (err) {
        if (myTransition === transitionId) {
          micStatus.textContent = `Microphone unavailable: ${err.message}`;
        }
        return;
      }
      if (myTransition !== transitionId) {
        // A newer mode switch has already taken over; leave mic/DOM state
        // to that transition instead of mounting on top of it.
        return;
      }
      micStatus.textContent = 'Microphone live — sing or hum a note';
    }

    activeInstance = mode.mount(modeContainer) ?? null;
  }

  if (modes.length > 0) {
    selectMode(modes[0].id);
  }

  return { selectMode };
}
