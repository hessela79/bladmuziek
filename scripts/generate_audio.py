#!/usr/bin/env python3
"""
Genereert 3 korte voorbeeld-mp3's (gesynthetiseerde toonladdertjes) als
placeholder voor echte ingezongen oefenfragmenten. Puur voor de demo.
"""
import math
import struct
import wave
import io
from pathlib import Path

import lameenc

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "audio"
SAMPLE_RATE = 44100

# Elke passage krijgt een eigen kort motiefje (noten als frequenties in Hz)
PASSAGES = {
    "passage-1": [392.00, 440.00, 523.25, 659.25, 523.25, 440.00],   # G4-A4-C5-E5-C5-A4 (sprong)
    "passage-2": [329.63, 329.63, 392.00, 329.63, 293.66, 261.63],   # E4 E4 G4 E4 D4 C4 (ritmisch)
    "passage-3": [261.63, 329.63, 392.00, 523.25],                    # C4-E4-G4-C5 (samenklank omhoog)
}

NOTE_SECONDS = 0.42


def synth_note(freq, duration, sample_rate=SAMPLE_RATE, volume=0.5):
    n = int(duration * sample_rate)
    attack = int(0.02 * sample_rate)
    release = int(0.08 * sample_rate)
    samples = []
    for i in range(n):
        t = i / sample_rate
        env = 1.0
        if i < attack:
            env = i / attack
        elif i > n - release:
            env = max(0.0, (n - i) / release)
        # grondtoon + zwakke boventoon voor een iets rijkere klank
        s = math.sin(2 * math.pi * freq * t) + 0.25 * math.sin(2 * math.pi * freq * 2 * t)
        samples.append(volume * env * s)
    return samples


def render_passage(freqs):
    pcm = []
    for f in freqs:
        pcm.extend(synth_note(f, NOTE_SECONDS))
        pcm.extend([0.0] * int(0.03 * SAMPLE_RATE))  # kleine stilte tussen noten
    pcm.extend([0.0] * int(0.15 * SAMPLE_RATE))  # staartje aan het eind
    return pcm


def to_pcm16_bytes(samples):
    return b"".join(struct.pack("<h", max(-32768, min(32767, int(s * 32767)))) for s in samples)


def encode_mp3(pcm16_bytes, out_path):
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(96)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    mp3_data = encoder.encode(pcm16_bytes)
    mp3_data += encoder.flush()
    out_path.write_bytes(mp3_data)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, freqs in PASSAGES.items():
        samples = render_passage(freqs)
        pcm16 = to_pcm16_bytes(samples)
        out_path = OUT_DIR / f"{name}.mp3"
        encode_mp3(pcm16, out_path)
        print(f"geschreven: {out_path} ({len(pcm16) / (2 * SAMPLE_RATE):.2f}s)")


if __name__ == "__main__":
    main()
