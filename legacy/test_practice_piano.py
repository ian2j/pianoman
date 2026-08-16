import pygame
import numpy as np

pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1)

pygame.font.init()
font = pygame.font.SysFont(None, 20)

WIDTH, HEIGHT = 1000, 300
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Mini Piano - 2 Octaves")

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (180, 180, 180)
BLUE = (100, 150, 255)

# Notes (C4 -> B5)
notes = {
    # Octave 4
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13,
    "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00,
    "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88,

    # Octave 5
    "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25,
    "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99,
    "G#5": 830.61, "A5": 880.00, "A#5": 932.33, "B5": 987.77,
}

# Key mapping (two rows on keyboard)
key_map = {
    # Lower octave
    pygame.K_a: "C4", pygame.K_w: "C#4", pygame.K_s: "D4",
    pygame.K_e: "D#4", pygame.K_d: "E4", pygame.K_f: "F4",
    pygame.K_t: "F#4", pygame.K_g: "G4", pygame.K_y: "G#4",
    pygame.K_h: "A4", pygame.K_u: "A#4", pygame.K_j: "B4",

    # Upper octave
    pygame.K_k: "C5", pygame.K_o: "C#5", pygame.K_l: "D5",
    pygame.K_p: "D#5", pygame.K_SEMICOLON: "E5", pygame.K_QUOTE: "F5",
    pygame.K_RIGHTBRACKET: "F#5",
}

# Reverse mapping: note -> keyboard key name
key_labels = {}
for k, v in key_map.items():
    key_labels[v] = pygame.key.name(k)

# Generate sound for each note
def generate_sound(freq, duration=1.2, sample_rate=44100):
    t = np.linspace(0, duration, int(sample_rate * duration), False)

    # --- Slight detune for stereo richness ---
    detune = 0.003  # small pitch offset

    # Left channel
    wave_l = (
        1.0 * np.sin(2 * np.pi * freq * t) +
        0.5 * np.sin(2 * np.pi * 2 * freq * t) +
        0.25 * np.sin(2 * np.pi * 3 * freq * t) +
        0.1 * np.sin(2 * np.pi * 4 * freq * t)
    )

    # Right channel (slightly detuned)
    wave_r = (
        1.0 * np.sin(2 * np.pi * freq * (1 + detune) * t) +
        0.5 * np.sin(2 * np.pi * 2 * freq * (1 + detune) * t) +
        0.25 * np.sin(2 * np.pi * 3 * freq * (1 + detune) * t) +
        0.1 * np.sin(2 * np.pi * 4 * freq * (1 + detune) * t)
    )

    # --- ADSR envelope ---
    attack = int(0.01 * sample_rate)
    decay = int(0.15 * sample_rate)
    sustain_level = 0.5
    release = int(0.4 * sample_rate)

    sustain = len(t) - (attack + decay + release)
    if sustain < 0:
        sustain = 0

    envelope = np.concatenate([
        np.linspace(0, 1, attack),
        np.linspace(1, sustain_level, decay),
        np.full(sustain, sustain_level),
        np.linspace(sustain_level, 0, release)
    ])

    envelope = envelope[:len(t)]

    # Apply envelope
    wave_l *= envelope
    wave_r *= envelope

    # --- Short attack noise (hammer-like transient) ---
    attack_noise_len = int(0.005 * sample_rate)  # 5 ms
    noise = np.random.randn(attack_noise_len)

    # Shape it to decay instantly
    noise_envelope = np.linspace(1, 0, attack_noise_len)
    noise *= noise_envelope

    # Pad to full length
    noise_full = np.zeros(len(t))
    noise_full[:attack_noise_len] = noise

    # Add lightly
    wave_l += 0.02 * noise_full
    wave_r += 0.02 * noise_full

    # Stack into stereo
    stereo = np.column_stack((wave_l, wave_r))

    # Normalize safely
    max_val = np.max(np.abs(stereo))
    if max_val > 0:
        stereo /= max_val

    audio = np.int16(stereo * 32767)
    return pygame.sndarray.make_sound(audio)


sounds = {note: generate_sound(freq) for note, freq in notes.items()}

# Layout
white_notes = [
    "C4","D4","E4","F4","G4","A4","B4",
    "C5","D5","E5","F5","G5","A5","B5"
]

black_notes = [
    "C#4","D#4",None,"F#4","G#4","A#4",None,
    "C#5","D#5",None,"F#5","G#5","A#5",None
]

key_width = WIDTH // len(white_notes)
black_width = key_width // 2
black_height = HEIGHT // 2

pressed_notes = set()

running = True
while running:
    screen.fill(GRAY)

    # White keys
    for i, note in enumerate(white_notes):
        rect = pygame.Rect(i * key_width, 0, key_width, HEIGHT)
        color = BLUE if note in pressed_notes else WHITE
        pygame.draw.rect(screen, color, rect)
        pygame.draw.rect(screen, BLACK, rect, 2)

        # --- Draw label ---
        label = f"{note}\n{key_labels.get(note, '')}"
        lines = label.split("\n")

        for j, line in enumerate(lines):
            text = font.render(line.upper(), True, BLACK)
            text_rect = text.get_rect(center=(
                rect.centerx,
                HEIGHT - 40 + j * 18
            ))
            screen.blit(text, text_rect)

    # Black keys
    for i, note in enumerate(black_notes):
        if note is None:
            continue

        x = (i + 1) * key_width - black_width // 2
        rect = pygame.Rect(x, 0, black_width, black_height)
        color = BLUE if note in pressed_notes else BLACK
        pygame.draw.rect(screen, color, rect)

        # --- Draw label ---
        label = f"{note}\n{key_labels.get(note, '')}"
        lines = label.split("\n")

        for j, line in enumerate(lines):
            text = font.render(line.upper(), True, WHITE)
            text_rect = text.get_rect(center=(
                rect.centerx,
                black_height - 30 + j * 15
            ))
            screen.blit(text, text_rect)

    pygame.display.flip()

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        if event.type == pygame.KEYDOWN:
            if event.key in key_map:
                note = key_map[event.key]
                pressed_notes.add(note)
                sounds[note].stop()
                sounds[note].play()

        if event.type == pygame.KEYUP:
            if event.key in key_map:
                note = key_map[event.key]
                pressed_notes.discard(note)

pygame.quit()