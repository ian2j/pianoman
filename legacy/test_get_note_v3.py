import pygame
import numpy as np
import sounddevice as sd
import librosa
import threading
import time
from collections import deque

pygame.init()

WIDTH = 1000
HEIGHT = 360

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Live Pitch Piano")

WHITE=(255,255,255)
BLACK=(0,0,0)
RED=(255,80,80)
GREY=(40,40,40)
GREEN=(80,220,120)

clock = pygame.time.Clock()

SR = 22050
BLOCK = 1024
WINDOW = int(0.12*SR)

audio_buffer = np.zeros(WINDOW*2)
buffer_lock = threading.Lock()

current_note = None
current_cents = 0
pitch_lock = threading.Lock()

note_history = deque(maxlen=5)

running = True


# ---------------------------
# AUDIO INPUT
# ---------------------------

def audio_callback(indata, frames, time_, status):

    global audio_buffer

    with buffer_lock:

        audio_buffer = np.roll(audio_buffer, -frames)
        audio_buffer[-frames:] = indata[:,0]


stream = sd.InputStream(
    channels=1,
    samplerate=SR,
    blocksize=BLOCK,
    callback=audio_callback
)

stream.start()


# ---------------------------
# PITCH DETECTOR THREAD
# ---------------------------

def pitch_worker():

    global current_note, current_cents

    while running:

        with buffer_lock:
            audio = audio_buffer[-WINDOW:].copy()

        volume = np.sqrt(np.mean(audio**2))

        if volume < 0.01:
            time.sleep(0.02)
            continue

        try:

            f0 = librosa.yin(
                audio,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C6"),
                sr=SR,
                frame_length=len(audio),
                hop_length=len(audio)
            )

            pitch = f0[0]

            if np.isnan(pitch):
                continue

            midi = round(librosa.hz_to_midi(pitch))
            note = librosa.midi_to_note(midi).replace("♯","#")

            ideal = librosa.midi_to_hz(midi)

            cents = 1200*np.log2(pitch/ideal)

        except:
            continue

        note_history.append(note)

        counts={}
        for n in note_history:
            counts[n]=counts.get(n,0)+1

        dominant=max(counts,key=counts.get)

        with pitch_lock:

            current_note = dominant
            current_cents = cents

        time.sleep(0.01)


thread = threading.Thread(target=pitch_worker)
thread.daemon = True
thread.start()


# ---------------------------
# PIANO
# ---------------------------

START_NOTE="C2"
END_NOTE="C6"

start_midi=librosa.note_to_midi(START_NOTE)
end_midi=librosa.note_to_midi(END_NOTE)

key_width = WIDTH / ((end_midi-start_midi+1)*7/12)


def draw_pitch_meter(cents):

    meter_width=300
    meter_height=20

    x=WIDTH/2-meter_width/2
    y=30

    pygame.draw.rect(screen,(80,80,80),(x,y,meter_width,meter_height))

    center=x+meter_width/2

    pygame.draw.line(screen,GREEN,(center,y),(center,y+meter_height),2)

    pos=center+(cents/50)*(meter_width/2)

    pos=max(x,min(x+meter_width,pos))

    pygame.draw.circle(screen,RED,(int(pos),int(y+meter_height/2)),6)


def draw_keyboard(active_note):

    if active_note:
        active_midi=librosa.note_to_midi(active_note)
    else:
        active_midi=None

    white_positions={}
    x=0

    for midi in range(start_midi,end_midi+1):

        name=librosa.midi_to_note(midi).replace("♯","#")

        if "#" not in name:

            color=WHITE
            if midi==active_midi:
                color=RED

            pygame.draw.rect(screen,color,(x,120,key_width,200))
            pygame.draw.rect(screen,BLACK,(x,120,key_width,200),2)

            white_positions[midi]=x
            x+=key_width


    for midi in range(start_midi,end_midi+1):

        name=librosa.midi_to_note(midi).replace("♯","#")

        if "#" in name:

            left=midi-1

            if left in white_positions:

                x=white_positions[left]+key_width*0.65

                color=BLACK
                if midi==active_midi:
                    color=RED

                pygame.draw.rect(screen,color,(x,120,key_width*0.6,120))


font = pygame.font.SysFont(None,40)


# ---------------------------
# MAIN LOOP
# ---------------------------

while running:

    for event in pygame.event.get():

        if event.type==pygame.QUIT:
            running=False


    with pitch_lock:
        note=current_note
        cents=current_cents


    screen.fill(GREY)

    draw_pitch_meter(cents)
    draw_keyboard(note)

    if note:
        text=font.render(note,True,(255,255,255))
        screen.blit(text,(20,20))


    pygame.display.flip()
    clock.tick(60)


pygame.quit()