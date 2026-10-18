"""Ensambla las páginas estáticas de FATO.

Uso:  python tools/build.py
- Lee _src/pages/*.html (cada una con un bloque <!--meta {...} --> al inicio).
- Genera una página por delegación (delegacion-<provincia>.html) a partir de
  _src/templates/delegacion.html y _src/delegaciones.json.
- Añade cabecera, iconos y pie comunes y escribe el HTML final en la raíz.
VERSION (fecha de hoy) se añade como ?v= a CSS/JS para forzar la recarga tras cada despliegue.
"""
import html, json, re, pathlib, datetime, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
VERSION = datetime.date.today().strftime("%Y%m%d")

part = {p.stem: p.read_text(encoding="utf-8") for p in (SRC / "partials").glob("*.html")}


def script_tag(name):
    path = "assets/data/%s.js" % name[len("../data/"):] if name.startswith("../data/") else "assets/js/%s.js" % name
    return '<script src="%s?v=%s" defer></script>\n' % (path, VERSION)


def render(raw, out_name):
    m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", raw, re.S)
    meta = json.loads(m.group(1)) if m else {}
    body = raw[m.end():] if m else raw

    head = part["head"]
    for key, val in {
        "title": meta.get("title", "FATO"),
        "description": meta.get("description", ""),
        "canonical": "" if out_name == "index.html" else out_name,
        "bodyClass": meta.get("bodyClass", ""),
        "preload": meta.get("preload", ""),
        "v": VERSION,
    }.items():
        head = head.replace("{{%s}}" % key, val)

    header = part["header"]
    nav = meta.get("nav")
    if nav:
        header = header.replace('data-nav="%s"' % nav, 'data-nav="%s" aria-current="page"' % nav)

    scripts = "".join(script_tag(s) for s in meta.get("scripts", []) + ["main"] + meta.get("after", []))
    page = head + part["sprite"] + header + '<main id="main">\n' + body.strip() + "\n</main>\n" + part["footer"] + scripts + "</body>\n</html>\n"
    (ROOT / out_name).write_text(page, encoding="utf-8")
    print("ok", out_name)


for page in sorted((SRC / "pages").glob("*.html")):
    render(page.read_text(encoding="utf-8"), page.name)

# ---- Páginas de delegación ----
tpl = (SRC / "templates" / "delegacion.html").read_text(encoding="utf-8")
delegs = json.loads((SRC / "delegaciones.json").read_text(encoding="utf-8"))
for d in delegs:
    e = html.escape
    tel = lambda p: "tel:+34" + p.replace(" ", "")
    phones_html = "".join('<a href="%s"><svg aria-hidden="true"><use href="#i-phone"/></svg>%s</a>' % (tel(p), e(p)) for p in d["phones"])
    address_html = '<span><svg aria-hidden="true"><use href="#i-pin"/></svg>%s</span>' % e(d["address"]) if d["address"] else ""
    people = []
    for role, name in (("Delegación de jueces-árbitros", d["jueces"]), ("Delegación de técnicos-entrenadores", d["tecnicos"])):
        initials = "".join(w[0] for w in name.split()[:2]) if name else "—"
        people.append('<div class="person"><span class="avatar">%s</span><div><span>%s</span><b%s>%s</b></div></div>' % (
            e(initials), role, "" if name else ' class="vacant"', e(name) if name else "Pendiente de designación"))
    others = "".join('<a href="delegacion-%s.html">%s</a>' % (o["slug"], e(o["name"])) for o in delegs if o["slug"] != d["slug"])
    phone_btn = '<a class="btn btn--ghost" href="%s"><svg aria-hidden="true"><use href="#i-phone"/></svg> %s</a>' % (tel(d["phones"][0]), e(d["phones"][0])) if d["phones"] else ""
    vals = {
        "name": e(d["name"]), "slug": d["slug"], "num": d["num"], "email": d["email"],
        "name_url": urllib.parse.quote(d["name"]), "phones_html": phones_html, "address_html": address_html,
        "committee_html": "".join(people), "others_html": others, "phone_btn": phone_btn,
        "map_q": urllib.parse.quote(d["map"]),
    }
    raw = tpl
    for k, v in vals.items():
        raw = raw.replace("{{%s}}" % k, v)
    render(raw, "delegacion-%s.html" % d["slug"])
