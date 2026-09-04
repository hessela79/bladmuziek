#!/usr/bin/env python3
"""
Genereert de demo-inhoud voor ALLE stukken: per stuk een nagemaakte
bladmuziek-PDF, gesynthetiseerde oefenfragment-mp3's, en de bijbehorende
data/pieces.json + data/passages/<id>.json.

Dit vervangt het losse generate_pdf.py/generate_audio.py van de
eerste (single-piece) versie van de demo.
"""
import json
import math
import struct
from pathlib import Path

import lameenc
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, black
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "assets" / "pdf"
AUDIO_DIR = ROOT / "assets" / "audio"
PASSAGES_DIR = ROOT / "data" / "passages"
PIECES_JSON = ROOT / "data" / "pieces.json"

PAGE_W, PAGE_H = A4
LEFT = 60
STAFF_WIDTH = PAGE_W - 2 * LEFT
LINE_SPACING = 8.0
MEASURES_PER_STAFF = 4
HIGHLIGHT = HexColor("#b9822f")
SAMPLE_RATE = 44100
NOTE_SECONDS = 0.42

VOICE_LABELS = {"S": "Sopraan", "A": "Alt", "T": "Tenor", "B": "Bas"}

# Elk stuk: id, titel, arrangeur, genre, stemgroepen, of er een solo is,
# en de motiefjes (frequenties in Hz) voor elke oefenpassage.
PIECES = [
    {
        "id": "ave-verum", "title": "Ave Verum Corpus",
        "composer": "arr. Marieke Hendriks", "genre": "Klassiek · Latijn",
        "voices": ["S", "A", "T", "B"], "solo": False,
        "passages": [
            {"voice": "S", "measures": [1, 2], "label": "Moeilijke sprong",
             "desc": "Lastige sprong in de sopraanpartij.",
             "freqs": [392.00, 440.00, 523.25, 659.25, 523.25, 440.00]},
            {"voice": "T", "measures": [2, 3], "label": "Samenzang",
             "desc": "Samenzang met de andere stemmen die vaak misgaat.",
             "freqs": [261.63, 329.63, 392.00, 523.25]},
        ],
    },
    {
        "id": "total-praise", "title": "Total Praise",
        "composer": "arr. Daniël Okafor", "genre": "Gospel",
        "voices": ["S", "A", "T", "B"], "solo": True,
        "passages": [
            {"voice": "S", "measures": [0, 1], "label": "Solo-inzet",
             "desc": "De solo-inzet die de sopranen samen oppakken.",
             "freqs": [349.23, 392.00, 440.00, 523.25, 587.33]},
            {"voice": "A", "measures": [1, 2], "label": "Ritme",
             "desc": "Syncopisch ritme dat vaak te vroeg komt.",
             "freqs": [293.66, 293.66, 329.63, 349.23, 293.66]},
            {"voice": "B", "measures": [2, 3], "label": "Fundament",
             "desc": "De baslijn die de harmonie draagt.",
             "freqs": [130.81, 164.81, 196.00, 130.81]},
        ],
    },
    {
        "id": "danny-boy", "title": "Danny Boy",
        "composer": "arr. Ruth Jansen", "genre": "Ierse ballade",
        "voices": ["S", "A", "T", "B"], "solo": False,
        "passages": [
            {"voice": "T", "measures": [1, 2], "label": "Hoge frase",
             "desc": "De lange, hoge frase in het middenstuk.",
             "freqs": [293.66, 349.23, 440.00, 523.25, 440.00, 349.23]},
        ],
    },
    {
        "id": "nunc-dimittis", "title": "Nunc Dimittis",
        "composer": "arr. Peter van Loon", "genre": "Klassiek · Avondzang",
        "voices": ["S", "A", "T", "B"], "solo": False,
        "passages": [
            {"voice": "A", "measures": [0, 1], "label": "Modulatie",
             "desc": "Modulatie die vaak vals wordt ingezet.",
             "freqs": [349.23, 392.00, 415.30, 466.16]},
            {"voice": "B", "measures": [2, 3], "label": "Slotcadens",
             "desc": "De lage slotcadens.",
             "freqs": [174.61, 146.83, 130.81, 98.00]},
        ],
    },
    {
        "id": "shenandoah", "title": "Shenandoah",
        "composer": "arr. Ilse Bakker", "genre": "Volkslied",
        "voices": ["S", "A", "T", "B"], "solo": False,
        "passages": [
            {"voice": "S", "measures": [1, 2], "label": "Herhaling met variatie",
             "desc": "Tweede couplet: zelfde melodie, andere afsluiting.",
             "freqs": [392.00, 440.00, 392.00, 349.23, 392.00]},
            {"voice": "A", "measures": [2, 3], "label": "Tegenstem",
             "desc": "De tegenstem die tegen de melodie in beweegt.",
             "freqs": [293.66, 277.18, 261.63, 293.66]},
        ],
    },
    {
        "id": "locus-iste", "title": "Locus Iste",
        "composer": "arr. Marieke Hendriks", "genre": "Klassiek · Motet",
        "voices": ["S", "A", "T", "B"], "solo": False,
        "passages": [
            {"voice": "S", "measures": [0, 1], "label": "Inzet",
             "desc": "De a-capellainzet zonder voorspel.",
             "freqs": [440.00, 493.88, 523.25]},
            {"voice": "T", "measures": [1, 2], "label": "Kruising",
             "desc": "Stemkruising met de altpartij.",
             "freqs": [349.23, 392.00, 349.23, 293.66]},
            {"voice": "B", "measures": [3, 3], "label": "Orgelpunt",
             "desc": "Lang aangehouden lage toon onder de andere stemmen.",
             "freqs": [98.00, 98.00, 98.00]},
        ],
    },
]


# ---------- PDF ----------

def draw_staff(c, x, y, width, label):
    c.setStrokeColor(black)
    c.setLineWidth(0.7)
    for i in range(5):
        ly = y + i * LINE_SPACING
        c.line(x, ly, x + width, ly)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(x - 52, y + LINE_SPACING * 2 - 3, label)

    measure_width = width / MEASURES_PER_STAFF
    bounds = []
    for m in range(MEASURES_PER_STAFF + 1):
        mx = x + m * measure_width
        c.setLineWidth(1.2 if m in (0, MEASURES_PER_STAFF) else 0.7)
        c.line(mx, y, mx, y + LINE_SPACING * 4)
    for m in range(MEASURES_PER_STAFF):
        bounds.append((x + m * measure_width, x + (m + 1) * measure_width))
    return bounds


def draw_note(c, x, y_step, staff_base):
    ny = staff_base + y_step * (LINE_SPACING / 2)
    c.saveState()
    c.translate(x, ny)
    c.setFillColor(black)
    c.ellipse(-3.2, -2.2, 3.2, 2.2, fill=1, stroke=0)
    if y_step < 4:
        c.line(3.0, 0, 3.0, 22)
    else:
        c.line(-3.0, 0, -3.0, -22)
    c.restoreState()


def draw_measure_notes(c, x0, x1, staff_base, rng_seed):
    import random
    rng = random.Random(rng_seed)
    n = rng.choice([3, 4])
    for i in range(n):
        nx = x0 + (i + 0.7) * (x1 - x0) / (n + 0.4)
        step = rng.randint(-1, 7)
        draw_note(c, nx, step, staff_base)


def highlight_measures(c, bounds, measure_indices, staff_base, label):
    x0 = bounds[measure_indices[0]][0]
    x1 = bounds[measure_indices[-1]][1]
    pad_y = 6
    y0 = staff_base - pad_y
    y1 = staff_base + LINE_SPACING * 4 + pad_y
    c.saveState()
    c.setFillColor(HIGHLIGHT)
    c.setFillAlpha(0.35)
    c.rect(x0, y0, x1 - x0, y1 - y0, fill=1, stroke=0)
    c.restoreState()
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(HexColor("#7c4a12"))
    c.drawString(x0, y1 + 3, label)
    return x0, y0, x1 - x0, y1 - y0


def to_normalized(rect, page_w, page_h):
    x, y, w, h = rect
    return {
        "xPct": round(x / page_w, 4),
        "yPct": round((page_h - (y + h)) / page_h, 4),
        "widthPct": round(w / page_w, 4),
        "heightPct": round(h / page_h, 4),
    }


def generate_pdf(piece):
    pdf_path = PDF_DIR / f"{piece['id']}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)

    passages_by_voice = {}
    for p in piece["passages"]:
        passages_by_voice.setdefault(p["voice"], []).append(p)

    voices = piece["voices"]
    pairs = [voices[i:i + 2] for i in range(0, len(voices), 2)]
    passage_records = []
    seed = 0

    for page_idx, pair in enumerate(pairs, start=1):
        c.setFont("Helvetica-Bold", 16)
        title_suffix = "" if page_idx == 1 else " (vervolg)"
        c.drawString(LEFT, PAGE_H - 50, f"{piece['title']}{title_suffix}")
        c.setFont("Helvetica", 9)
        c.drawString(LEFT, PAGE_H - 66, f"{piece['composer']} · demo-notatie")

        staff_y_positions = [PAGE_H - 140, PAGE_H - 230]
        for label_letter, sy in zip(pair, staff_y_positions):
            bounds = draw_staff(c, LEFT, sy, STAFF_WIDTH, VOICE_LABELS[label_letter])
            for mi, (x0, x1) in enumerate(bounds):
                seed += 1
                draw_measure_notes(c, x0, x1, sy, seed)

            for p in passages_by_voice.get(label_letter, []):
                rect = highlight_measures(c, bounds, p["measures"], sy,
                                           f"{p['label']}")
                passage_records.append({
                    "id": f"{piece['id']}-{label_letter.lower()}-{p['measures'][0]}",
                    "title": f"{VOICE_LABELS[label_letter]}, maat {p['measures'][0] + 1}-{p['measures'][-1] + 1} — {p['label']}",
                    "description": p["desc"],
                    "audio": f"assets/audio/{piece['id']}/{p['label'].lower().replace(' ', '-')}.mp3",
                    "page": page_idx,
                    "freqs": p["freqs"],
                    "slug": p["label"].lower().replace(" ", "-"),
                    **to_normalized(rect, PAGE_W, PAGE_H),
                })

        c.setFont("Helvetica", 8)
        c.drawString(LEFT, 40, f"Pagina {page_idx} van {len(pairs)}")
        c.showPage()

    c.save()
    return passage_records


# ---------- Audio ----------

def synth_note(freq, duration, volume=0.5):
    n = int(duration * SAMPLE_RATE)
    attack = int(0.02 * SAMPLE_RATE)
    release = int(0.08 * SAMPLE_RATE)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = 1.0
        if i < attack:
            env = i / attack
        elif i > n - release:
            env = max(0.0, (n - i) / release)
        s = math.sin(2 * math.pi * freq * t) + 0.25 * math.sin(2 * math.pi * freq * 2 * t)
        samples.append(volume * env * s)
    return samples


def render_passage_audio(freqs):
    pcm = []
    for f in freqs:
        pcm.extend(synth_note(f, NOTE_SECONDS))
        pcm.extend([0.0] * int(0.03 * SAMPLE_RATE))
    pcm.extend([0.0] * int(0.15 * SAMPLE_RATE))
    return pcm


def to_pcm16_bytes(samples):
    return b"".join(struct.pack("<h", max(-32768, min(32767, int(s * 32767)))) for s in samples)


def encode_mp3(pcm16_bytes, out_path):
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(96)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    data = encoder.encode(pcm16_bytes) + encoder.flush()
    out_path.write_bytes(data)


# ---------- Main ----------

def main():
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    PASSAGES_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []

    for piece in PIECES:
        passage_records = generate_pdf(piece)

        piece_audio_dir = AUDIO_DIR / piece["id"]
        piece_audio_dir.mkdir(parents=True, exist_ok=True)
        for rec in passage_records:
            samples = render_passage_audio(rec.pop("freqs"))
            pcm16 = to_pcm16_bytes(samples)
            out_path = piece_audio_dir / f"{rec.pop('slug')}.mp3"
            encode_mp3(pcm16, out_path)

        passages_path = PASSAGES_DIR / f"{piece['id']}.json"
        passages_path.write_text(json.dumps(passage_records, indent=2, ensure_ascii=False) + "\n")

        manifest.append({
            "id": piece["id"],
            "title": piece["title"],
            "composer": piece["composer"],
            "genre": piece["genre"],
            "voices": piece["voices"],
            "solo": piece["solo"],
            "passageCount": len(passage_records),
            "pdf": f"assets/pdf/{piece['id']}.pdf",
            "passagesData": f"data/passages/{piece['id']}.json",
        })
        print(f"{piece['id']}: PDF + {len(passage_records)} audiofragment(en) klaar")

    PIECES_JSON.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"\nmanifest geschreven: {PIECES_JSON}")


if __name__ == "__main__":
    main()
