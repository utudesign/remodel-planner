"""Parse Spring Forest 2026 price-list PDFs (tables) + the order-form grid. Usage: python3 -I parse_sf.py <dir> <out.json>"""
import json, re, sys, glob, os
import openpyxl, pdfplumber

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else None

LINES = {  # file → line name, door style, colors in that file
    "Essential and Charm Price List 2026 - Spring Forest.pdf": "essential_charm",
    "Classic and Double Shaker Price List 2026 - Spring Forest.pdf": "classic_double",
    "Slim Shaker Price List 2026 - Spring Forest.pdf": "slim",
    "Frameless List 2026 - Spring Forest.pdf": "frameless",
    "Builder Grade Price List 2026 - Spring Forest.pdf": "builder",
}
# Full color groups per file (first table header carries all colors; later headers shorten them).
FULL = {
    "essential_charm": [["SW", "GR"], ["SE", "NB"], ["AG", "IB", "SA", "LG", "SB"], ["TC", "RW"]],
    "classic_double": [["AW"], ["AC"], ["DDW", "DSG"], ["CW"]],
    "slim": [["SDW"], ["SAG", "SIB"], ["SWO", "SAO"]],
    "frameless": [["HW", "HG"], ["MB", "MI"], ["OB", "OS"], ["CG", "MG"]],
    "builder": [["FW", "FG"], ["FE"]],
}

PRICE = re.compile(r"^\$?\s*([\d,]+(?:\.\d+)?)$")
NA = {"#N/A", "\\#N/A", "N/A", "NOT AVAILABLE", ""}


def price(cell):
    if cell is None:
        return None
    c = str(cell).strip().replace("\n", " ")
    if c.upper() in NA:
        return None
    if "/" in c:  # "$15.00/$22.00" (touch-up kit: two colors) → first; grid gives per color
        c = c.split("/")[0]
    m = PRICE.match(c.replace("$", "").strip())
    if not m:
        return "BAD:" + c
    return round(float(m.group(1).replace(",", "")) * 100)


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def parse_pdf(path, line):
    groups = FULL[line]
    out, warnings = [], []
    banner, section = None, None
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            for t in page.extract_tables():
                for row in t:
                    cells = [clean(c) for c in row]
                    if not any(cells):
                        continue
                    first = cells[0]
                    rest = [c for c in cells[1:] if c]
                    if first.startswith("***"):
                        banner = first.strip("* ").strip()
                        continue
                    if first == "Item Name":
                        heads = cells[2:2 + len(groups)]
                        for i, h in enumerate(heads):
                            if h and h.split("/")[0] not in groups[i]:
                                warnings.append(f"p{pno} header {heads} vs {groups}")
                                break
                        continue
                    if not rest and first:  # subsection heading
                        section = first
                        continue
                    if first.startswith("*") or (len(cells) > 1 and not cells[1] and not any(cells[2:])):
                        continue  # note line
                    if not cells[1] and first:
                        section = first
                        continue
                    prices = [price(c) for c in cells[2:2 + len(groups)]]
                    bad = [p for p in prices if isinstance(p, str)]
                    if bad:
                        warnings.append(f"p{pno} {first}: {bad}")
                        continue
                    out.append({"code": first, "name": cells[1], "banner": banner, "section": section,
                                "prices": prices, "page": pno})
    return out, warnings


def parse_grid(path):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = list(wb["Price List"].iter_rows(values_only=True))
    hdr = [str(h) for h in rows[0]]
    grid = {}
    for r in rows[1:]:
        if not r[0]:
            continue
        grid[str(r[0]).strip()] = {
            "name": clean(r[1]),
            "assemble": bool(r[2]),
            "prices": {hdr[i]: (round(float(r[i]) * 100) if isinstance(r[i], (int, float)) else None)
                       for i in range(3, len(hdr))},
        }
    return grid


def main():
    grid = parse_grid(os.path.join(SRC, "2026 Order Form - 65% - Spring Forest.xlsm"))
    result, problems = {}, []
    for fname, line in LINES.items():
        items, warns = parse_pdf(os.path.join(SRC, fname), line)
        problems += [f"{line}: {w}" for w in warns]
        groups = FULL[line]
        for it in items:
            g = grid.get(it["code"])
            it["assemble"] = g["assemble"] if g else None
            for gi, colors in enumerate(groups):
                pdfp = it["prices"][gi]
                for col in colors:
                    gp = g["prices"].get(col) if g else None
                    if g and gp != pdfp:
                        problems.append(f"{line} {it['code']} {col}: pdf {pdfp} grid {gp}")
            if not g:
                problems.append(f"{line} {it['code']}: not in order-form grid")
        result[line] = items
    if OUT:
        json.dump({"lines": result, "groups": FULL, "grid": grid}, open(OUT, "w"), indent=1)
    print({k: len(v) for k, v in result.items()})
    print(len(problems), "differences/warnings")
    for p in problems:
        print("  ", p)


main()


# ---------------------------------------------------------------------------------------------
# Import payload (change request v3 batch C). Run:
#   python3 -I scripts/skyline/parse_springforest.py <folder with the Spring Forest files> /tmp/sf.json
#   python3 -I scripts/skyline/build_payload.py /tmp/sf.json supabase/seed/skyline-springforest-2026.json
# ---------------------------------------------------------------------------------------------
