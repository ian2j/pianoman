import pygame
import numpy as np
import sounddevice as sd
import librosa

pygame.init()

WIDTH = 800
HEIGHT = 300

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Live Pitch Piano")

WHITE = (255,255,255)
BLACK = (0,0,0)
RED = (255,80,80)

clock = pygame.time.Clock()

white_notes = ['C','D','E','F','G','A','B']

key_width = WIDTH // 14


def detect_pitch():

    duration = 0.15
    sr = 22050

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

    note = librosa.hz_to_note(pitch)

    return note.replace("♯","#")


def draw_keyboard(active_note):

    screen.fill((30,30,30))

    x = 0

    for octave in [3,4]:

        for n in white_notes:

            note = f"{n}{octave}"

            color = WHITE

            if note == active_note:
                color = RED

            pygame.draw.rect(
                screen,
                color,
                (x,100,key_width,180)
            )

            pygame.draw.rect(
                screen,
                BLACK,
                (x,100,key_width,180),
                2
            )

            x += key_width


    black_offsets = {
        'C#':0.7,
        'D#':1.7,
        'F#':3.7,
        'G#':4.7,
        'A#':5.7
    }

    for octave in [3,4]:

        base = (octave-3)*7*key_width

        for n,offset in black_offsets.items():

            note = f"{n}{octave}"

            x = base + offset*key_width

            color = BLACK

            if note == active_note:
                color = RED

            pygame.draw.rect(
                screen,
                color,
                (x,100,0.6*key_width,120)
            )


running = True
current_note = None

while running:

    for event in pygame.event.get():

        if event.type == pygame.QUIT:
            running = False


    detected = detect_pitch()

    if detected:
        current_note = detected

    draw_keyboard(current_note)

    pygame.display.flip()

    clock.tick(30)

pygame.quit()