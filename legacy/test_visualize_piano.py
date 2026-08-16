import pygame
import time

notes = [
'C3','C3','G3','G3','A3','G#3','G3','F#3','E3',
'C3','G3','G3','G3','F#3','E3','C3'
]

pygame.init()

WIDTH = 800
HEIGHT = 300

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Piano Visualizer")

WHITE = (255,255,255)
BLACK = (0,0,0)
RED = (255,80,80)
GREY = (180,180,180)

clock = pygame.time.Clock()

white_notes = ['C','D','E','F','G','A','B']

key_width = WIDTH // 14

def normalize(note):

    if note is None:
        return None

    return note.replace("♯","#")


def draw_keyboard(active_note):

    screen.fill((30,30,30))

    x = 0
    white_positions = {}

    # draw white keys
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

            white_positions[n] = x

            x += key_width


    # draw black keys
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
note_index = 0
last_change = time.time()

while running:

    for event in pygame.event.get():

        if event.type == pygame.QUIT:
            running = False


    if time.time() - last_change > 0.6:

        note_index = (note_index + 1) % len(notes)
        last_change = time.time()

    note = normalize(notes[note_index])

    draw_keyboard(note)

    pygame.display.flip()

    clock.tick(60)

pygame.quit()