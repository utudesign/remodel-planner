"""Build the Skyline (Spring Forest 2026) import payload from parse_springforest.py output.

Rules (docs/DECISIONS.md, v3 batch C):
  - Items + descriptions + availability come from the 5 price-list PDFs (one description per line:
    a frameless B36 is not a framed B36).
  - Prices: where the PDF and the order-form grid disagree, the HIGHER list price is used (a few items:
    wood tray, waste bin, touch-up kit).
  - Cost = list x 0.35 (order form "65%" = 65% off; checked: B12 HW $456 list → $159.60 on the form).
    Items marked "Excluded from discount" (Waste Bin, TUK) cost the full list price.
  - Samples (SD, MINI, SB15MINI) and note lines are skipped.
"""
import json, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
d = json.load(open(SRC))
grid = d["grid"]
MULT = 0.35
EXCLUDED = {"WASTE BIN", "TUK"}
SKIP = {"SD", "MINI", "SB15MINI"}

LINE_LABEL = {
    "essential_charm": "Essential & Charm",
    "classic_double": "Classic & Double Shaker",
    "slim": "Slim Shaker",
    "frameless": "Frameless",
    "builder": "Builder Grade",
}
# color → (series shown in the picker, name from the 2026 brochure)
COLORS = {
    "SW": ("Essential", "Shaker White"), "GR": ("Essential", "Shaker Gray"), "SE": ("Essential", "Shaker Espresso"),
    "NB": ("Charm", "Navy Blue"), "AG": ("Charm", "Aston Green"), "IB": ("Charm", "Iron Black"),
    "SA": ("Charm", "Smokey Ash"), "LG": ("Charm", "Lunar Gray"), "SB": ("Charm", "Sage Breeze"),
    "TC": ("Charm", "Treasure Chest"), "RW": ("Charm", "Rustic Wood"),
    "AW": ("Classic", "Aspen White"), "AC": ("Classic", "Aspen Charcoal"), "CW": ("Classic", "Charleston White"),
    "DDW": ("Double Shaker", "Double Dove White"), "DSG": ("Double Shaker", "Double Smokey Gray"),
    "SDW": ("Slim Shaker", "Slim Dove White"), "SAG": ("Slim Shaker", "Slim Aston Green"),
    "SIB": ("Slim Shaker", "Slim Iron Black"), "SWO": ("Slim Shaker", "Slim White Oak"),
    "SAO": ("Slim Shaker", "Slim Amber Oak"),
    "HW": ("Frameless", "High Glossy White"), "HG": ("Frameless", "High Glossy Gray"), "MB": ("Frameless", "Matt Black"),
    "MI": ("Frameless", "Matt Ivory"), "OB": ("Frameless", "Oak Blonde"), "OS": ("Frameless", "Oak Shade"),
    "CG": ("Frameless", "Crystal Glass"), "MG": ("Frameless", "Midnight Glass"),
    "FW": ("Builder Grade", "Floral White"), "FG": ("Builder Grade", "Floral Gray"), "FE": ("Builder Grade", "Floral Espresso"),
}
SERIES_ORDER = ["Essential", "Charm", "Classic", "Double Shaker", "Slim Shaker", "Frameless", "Builder Grade"]
TRIM_SECTIONS = {"MOULDINGS", "FILLERS", "PANELS"}
ACCESSORY_SECTIONS = {"ACCESSORIES", "ROLL OUT TRAYS", "TOUCH UP ITEM"}
ACCESSORY_CODES = re.compile(r"^(CHROME|WOOD TRAY|WASTE BIN|PWB-BBC\d+ TRAY|TUK)", re.I)


def category(section, code):
    if section in TRIM_SECTIONS:
        return "Fillers & trim"
    if section in ACCESSORY_SECTIONS or ACCESSORY_CODES.match(code):
        return "Cabinet accessories"
    return "Cabinets"


def code_for(item, line):
    if item["code"]:
        return item["code"]
    # one frameless row lost its code cell in the PDF; find it in the order-form grid by description
    hits = [k for k, v in grid.items() if v["name"].split(" - ")[0] == item["name"].split(" - ")[0] and k.startswith("PWB-")]
    return hits[0] if len(hits) == 1 else None


collections, colors, report = [], [], {"higher_of_two": [], "pdf_only": [], "skipped": []}
sort = 0
for line, items in d["lines"].items():
    for gi, group in enumerate(d["groups"][line]):
        sort += 1
        out = []
        seen = set()
        for it in items:
            code = code_for(it, line)
            if not code or it["name"].startswith("*"):
                continue
            if code.upper() in SKIP:
                report["skipped"].append(f"{line} {code}")
                continue
            pdf = it["prices"][gi]
            if pdf is None:
                continue  # not offered in this color group (the PDF decides availability)
            g = grid.get(code)
            gp = [g["prices"].get(c) for c in group] if g else []
            gp = [p for p in gp if p is not None]
            lst = max([pdf] + gp)
            if lst != pdf:
                report["higher_of_two"].append(f"{line} {'/'.join(group)} {code}: pdf {pdf} grid {max(gp)}")
            if not g:
                report["pdf_only"].append(f"{line} {code}")
            if code in seen:
                continue
            seen.add(code)
            excluded = code.upper() in EXCLUDED
            out.append({
                "code": code,
                "description": it["name"],
                "unit": "ea",
                "list_price_cents": lst,
                "cost_cents": lst if excluded else round(lst * MULT),
                "category": category(it["section"], code),
            })
        name = f"Skyline {LINE_LABEL[line]} {'/'.join(group)}"
        collections.append({"name": name, "colors": group, "sort_order": sort, "items": out})
        for c in group:
            series, cname = COLORS[c]
            colors.append({
                "code": c, "name": cname, "line": series, "collection": name,
                "sort_order": SERIES_ORDER.index(series) * 100 + len(colors),
                "swatch_url": f"/swatches/skyline/{c}.jpg",
            })

payload = {
    "vendor": "Skyline",
    "list_name": "Skyline (Spring Forest) 2026",
    "cost_multiplier": MULT,
    "effective_date": "2026-03-06",
    "source_file": "Spring Forest 2026 price lists + 2026 Order Form (65%)",
    "collections": collections,
    "colors": colors,
}
json.dump(payload, open(OUT, "w"), separators=(",", ":"))
n = sum(len(c["items"]) for c in collections)
print(f"{len(collections)} color groups, {len(colors)} colors, {n} priced items")
for k, v in report.items():
    print(k, len(v))
    for x in v[:40]:
        print("   ", x)
