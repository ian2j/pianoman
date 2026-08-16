import pygame
import numpy as np
import sounddevice as sd
import librosa
from collections import deque

pygame.init()

WIDTH = 1000
HEIGHT = 320

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Live Pitch Piano")

WHITE = (255,255,255)
BLACK = (0,0,0)
RED = (255,80,80)
GREY = (40,40,40)

clock = pygame.time.Clock()

sr = 22050
duration = 0.15

# smoothing memory
note_history = deque(maxlen=6)

# piano range
START_NOTE = "C2"
END_NOTE = "C6"

start_midi = librosa.note_to_midi(START_NOTE)
end_midi = librosa.note_to_midi(END_NOTE)

white_notes = ['C','D','E','F','G','A','B']

num_white = (end_midi - start_midi + 1) * 7 // 12
key_width = WIDTH // num_white


def detect_pitch():

    audio = sd.rec(
        int(duration * sr),
        samplerate=sr,
        channels=1
    )

    sd.wait()

    audio = audio.flatten()

    f0 = librosa.yin(
        audio,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C6')
    )

    pitch = np.median(f0)

    if np.isnan(pitch):
        return None

    note = librosa.hz_to_note(pitch).replace("♯","#")

    note_history.append(note)

    # dominant note voting
    counts = {}

    for n in note_history:
        counts[n] = counts.get(n,0)+1

    dominant = max(counts, key=counts.get)

    return dominant


def draw_keyboard(active_note):

    screen.fill(GREY)

    if active_note:
        active_midi = librosa.note_to_midi(active_note)
    else:
        active_midi = None

    white_positions = {}

    x = 0

    # draw white keys
    for midi in range(start_midi, end_midi+1):

        name = librosa.midi_to_note(midi).replace("♯","#")

        if "#" not in name:

            color = WHITE

            if midi == active_midi:
                color = RED

            pygame.draw.rect(
                screen,
                color,
                (x,100,key_width,200)
            )

            pygame.draw.rect(
                screen,
                BLACK,
                (x,100,key_width,200),
                2
            )

            white_positions[midi] = x
            x += key_width


    # draw black keys
    for midi in range(start_midi, end_midi+1):

        name = librosa.midi_to_note(midi).replace("♯","#")

        if "#" in name:

            left = midi - 1

            if left in white_positions:

                x = white_positions[left] + key_width * 0.65

                color = BLACK

                if midi == active_midi:
                    color = RED

                pygame.draw.rect(
                    screen,
                    color,
                    (x,100,key_width*0.6,120)
                )


running = True
current_note = None

font = pygame.font.SysFont(None, 40)

while running:

    for event in pygame.event.get():

        if event.type == pygame.QUIT:
            running = False


    detected = detect_pitch()

    if detected:
        current_note = detected

    draw_keyboard(current_note)

    if current_note:

        text = font.render(current_note, True, (255,255,255))
        screen.blit(text,(20,20))

    pygame.display.flip()

    clock.tick(30)

pygame.quit()