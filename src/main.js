import './style.css';
import { createModeNav } from './ui/mode-nav.js';
import { pitchMirrorMode } from './modes/pitch-mirror.js';
import { referencePianoMode } from './modes/reference-piano.js';
import { singBackMode } from './modes/sing-back.js';
import { melodyFollowMode } from './modes/melody-follow.js';
import { songTranscribeMode } from './modes/song-transcribe.js';

const app = document.getElementById('app');

const header = document.createElement('header');
header.classList.add('app-header');

const title = document.createElement('h1');
title.textContent = 'Pianoman';

const subtitle = document.createElement('p');
subtitle.textContent = 'Ear-to-key training: sing a note, see the key, build the association.';

header.append(title, subtitle);

const navHost = document.createElement('div');

app.append(header, navHost);

createModeNav(navHost, [
  pitchMirrorMode,
  referencePianoMode,
  singBackMode,
  melodyFollowMode,
  songTranscribeMode,
]);
