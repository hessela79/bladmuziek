#!/usr/bin/env python3
"""
Genereert een voorbeeld-PDF met (nagemaakte) bladmuziek voor de demo.
Dit is GEEN echte muzieknotatie-engine - het tekent simpele notenbalken,
notenkopjes en maatstrepen zodat het er als bladmuziek uitziet, plus een
paar gemarkeerde "moeilijke passages".

Het script schrijft ook data/passages.json: voor elke gemarkeerde passage
de paginanummer en de positie or de pagina, genormaliseerd (0-1) met de
oorsprong linksboven - precies wat de webviewer nodig heeft om de
afspeelknoppen op de juiste plek over de gerenderde PDF-pagina te leggen.
"""
import json
import random
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, black
from reportlab.pdfgen import canvas

random.seed(42)

PAGE_W, PAGE_H = A4
ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / "assets" / "pdf" / "voorbeeld-bladmuziek.pdf"
PASSAGES_PATH = ROOT / "data" / "passages.json"

LINE_SPACING = 8.0          # afstand tussen notenbalklijnen
STAFF_WIDTH = PAGE_W - 2 * 60
LEFT = 60
MEASURES_PER_STAFF = 4

HIGHLIGHT = HexColor("#fbbf24")  # amber, 35% dekking hieronder ingesteld


def draw_staff(c, x, y, width, label):
    """Tekent een notenbalk (5 lijnen) met stemlabel, retourneert de maatgrenzen."""
    c.setStrokeColor(black)
    c.setLineWidth(0.7)
    for i in range(5):
        ly = y + i * LINE_SPACING
        c.line(x, ly, x + width, ly)

    c.setFont("Helvetica-Oblique", 9)
    c.drawString(x - 52, y + LINE_SPACING * 2 - 3, label)

    # buitenste maatstrepen + tussenliggende maatstrepen
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
    """Tekent een notenkopje (gevuld ovaal) + stok op een gegeven regel/spatie."""
    ny = staff_base + y_step * (LINE_SPACING / 2)
    c.saveState()
    c.translate(x, ny)
    c.setFillColor(black)
    c.ellipse(-3.2, -2.2, 3.2, 2.2, fill=1, stroke=0)
    stem_up = y_step < 4
    if stem_up:
        c.line(3.0, 0, 3.0, 22)
    else:
        c.line(-3.0, 0, -3.0, -22)
    c.restoreState()


def draw_measure_notes(c, x0, x1, staff_base):
    """Vult een maat met 3-4 willekeurige noten, verspreid over de maatbreedte."""
    n = random.choice([3, 4])
    for i in range(n):
        nx = x0 + (i + 0.7) * (x1 - x0) / (n + 0.4)
        step = random.randint(-1, 7)
        draw_note(c, nx, step, staff_base)


def highlight_measures(c, bounds, measure_indices, staff_base, label):
    """Tekent een gemarkeerd (amber) blok achter de opgegeven maten en een labeltje erboven."""
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
    c.setFillColor(HexColor("#92400e"))
    c.drawString(x0, y1 + 3, label)

    return x0, y0, x1 - x0, y1 - y0


def to_normalized(rect, page_w, page_h):
    """Zet een PDF-rect (oorsprong linksonder) om naar genormaliseerde
    coördinaten met de oorsprong linksboven, zoals de webviewer verwacht."""
    x, y, w, h = rect
    return {
        "xPct": round(x / page_w, 4),
        "yPct": round((page_h - (y + h)) / page_h, 4),
        "widthPct": round(w / page_w, 4),
        "heightPct": round(h / page_h, 4),
    }


def main():
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    PASSAGES_PATH.parent.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(PDF_PATH), pagesize=A4)
    passages = []

    # ---------- Pagina 1 ----------
    c.setFont("Helvetica-Bold", 16)
    c.drawString(LEFT, PAGE_H - 50, "Voorbeeld Bladmuziek — Demo")
    c.setFont("Helvetica", 9)
    c.drawString(LEFT, PAGE_H - 66,
                 "Dit is nagemaakte notatie, alleen bedoeld om de afspeelknoppen te demonstreren.")

    voices_page1 = ["Sopraan", "Alt"]
    staff_y_positions = [PAGE_H - 140, PAGE_H - 230]
    all_bounds_p1 = []
    for label, sy in zip(voices_page1, staff_y_positions):
        bounds = draw_staff(c, LEFT, sy, STAFF_WIDTH, label)
        for (x0, x1) in bounds:
            draw_measure_notes(c, x0, x1, sy)
        all_bounds_p1.append((label, bounds, sy))

    # Passage 1: maat 2-3 van de Sopraan-partij
    label, bounds, sy = all_bounds_p1[0]
    rect = highlight_measures(c, bounds, [1, 2], sy, "Passage 1 — moeilijke sprong")
    passages.append({
        "id": "passage-1",
        "title": "Passage 1 — Sopraan, maat 2-3",
        "description": "Lastige sprong in de sopraanpartij.",
        "audio": "assets/audio/passage-1.mp3",
        "page": 1,
        **to_normalized(rect, PAGE_W, PAGE_H),
    })

    # Passage 2: maat 1 van de Alt-partij
    label, bounds, sy = all_bounds_p1[1]
    rect = highlight_measures(c, bounds, [0], sy, "Passage 2 — ritme")
    passages.append({
        "id": "passage-2",
        "title": "Passage 2 — Alt, maat 1",
        "description": "Lastig ritme aan het begin van de altpartij.",
        "audio": "assets/audio/passage-2.mp3",
        "page": 1,
        **to_normalized(rect, PAGE_W, PAGE_H),
    })

    c.setFont("Helvetica", 8)
    c.drawString(LEFT, 40, "Pagina 1 van 2")
    c.showPage()

    # ---------- Pagina 2 ----------
    c.setFont("Helvetica-Bold", 16)
    c.drawString(LEFT, PAGE_H - 50, "Voorbeeld Bladmuziek — Demo (vervolg)")

    voices_page2 = ["Tenor", "Bas"]
    all_bounds_p2 = []
    for label, sy in zip(voices_page2, staff_y_positions):
        bounds = draw_staff(c, LEFT, sy, STAFF_WIDTH, label)
        for (x0, x1) in bounds:
            draw_measure_notes(c, x0, x1, sy)
        all_bounds_p2.append((label, bounds, sy))

    # Passage 3: maat 3-4 van de Tenor-partij
    label, bounds, sy = all_bounds_p2[0]
    rect = highlight_measures(c, bounds, [2, 3], sy, "Passage 3 — samenzang")
    passages.append({
        "id": "passage-3",
        "title": "Passage 3 — Tenor, maat 3-4",
        "description": "Samenzang met de andere stemmen die vaak misgaat.",
        "audio": "assets/audio/passage-3.mp3",
        "page": 2,
        **to_normalized(rect, PAGE_W, PAGE_H),
    })

    c.setFont("Helvetica", 8)
    c.drawString(LEFT, 40, "Pagina 2 van 2")
    c.showPage()
    c.save()

    PASSAGES_PATH.write_text(json.dumps(passages, indent=2, ensure_ascii=False) + "\n")
    print(f"PDF geschreven naar {PDF_PATH}")
    print(f"passages.json geschreven naar {PASSAGES_PATH}")


if __name__ == "__main__":
    main()
