"""Descarga las competiciones de fato.es (The Events Calendar) y genera un archivo
de datos por delegación en assets/data/deleg-<provincia>.js

Uso:
    python tools/build_delegaciones.py            # descarga desde la API y genera
    python tools/build_delegaciones.py --cache DIR  # usa JSON ya descargados (p*.json)

La web, además, intenta refrescar las próximas competiciones en directo desde la API;
estos archivos son la copia de seguridad si la API no responde.
"""
import argparse, datetime, glob, html, json, os, pathlib, re, sys, unicodedata, urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "data"
API = "https://fato.es/wp-json/tribe/events/v1/events"
YEAR = datetime.date.today().year

PROVS = {"almeria": "Almería", "cadiz": "Cádiz", "cordoba": "Córdoba", "granada": "Granada",
         "huelva": "Huelva", "jaen": "Jaén", "malaga": "Málaga", "sevilla": "Sevilla"}
CAT = {"precision": "precision", "aire comprimido": "precision", "plato": "plato", "rrtt": "recorridos",
       "armas historicas": "historicas", "alta precision": "alta", "fclass": "fclass"}


def slug(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]+", " ", s).strip()


def prov_of(name):
    s = slug(name)
    for k in PROVS:
        if s == k or s.startswith(k):
            return k
    return None


class Clean(HTMLParser):
    """Deja solo texto, párrafos, listas, negritas y enlaces http/mailto/tel."""
    KEEP = {"p", "br", "strong", "b", "em", "ul", "ol", "li"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.links, self._a = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag in self.KEEP:
            self.out.append("<%s>" % ("strong" if tag == "b" else tag))
        elif tag == "a":
            href = dict(attrs).get("href", "") or ""
            if re.match(r"^(https?:|mailto:|tel:)", href):
                self._a = [href, ""]
                self.out.append('<a href="%s" target="_blank" rel="noopener">' % html.escape(href, quote=True))

    def handle_endtag(self, tag):
        if tag in self.KEEP and tag != "br":
            self.out.append("</%s>" % ("strong" if tag == "b" else tag))
        elif tag == "a" and self._a:
            self.out.append("</a>")
            self.links.append(tuple(self._a))
            self._a = None

    def handle_data(self, data):
        self.out.append(html.escape(data))
        if self._a is not None:
            self._a[1] += data


def clean_desc(raw):
    p = Clean()
    p.feed(raw or "")
    h = "".join(p.out)
    h = re.sub(r"<p>\s*(&nbsp;|\xa0)?\s*</p>", "", h).replace("\xa0", " ")
    h = re.sub(r"\s+", " ", h).strip()
    results = []
    for href, text in p.links:
        t = text.strip()
        if href.lower().endswith(".pdf") or "resultado" in t.lower() or "clasificaci" in t.lower():
            results.append([t or "Resultados", href])
    return h, results


def fetch_all(cache):
    os.makedirs(cache, exist_ok=True)
    page, pages = 1, 1
    while page <= pages:
        url = "%s?per_page=50&page=%d&start_date=%d-01-01&end_date=%d-12-31" % (API, page, YEAR, YEAR + 1)
        req = urllib.request.Request(url, headers={"User-Agent": "FATO-web/1.0"})
        data = json.loads(urllib.request.urlopen(req, timeout=90).read().decode("utf-8"))
        json.dump(data, open(os.path.join(cache, "p%d.json" % page), "w", encoding="utf-8"))
        pages = data.get("total_pages", 1)
        print("página", page, "de", pages)
        page += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(ROOT / "tools" / "_eventos"))
    ap.add_argument("--no-fetch", action="store_true")
    a = ap.parse_args()
    if not a.no_fetch:
        for f in glob.glob(os.path.join(a.cache, "p*.json")):
            os.remove(f)
        fetch_all(a.cache)

    raw = []
    for f in sorted(glob.glob(os.path.join(a.cache, "p*.json"))):
        raw += json.load(open(f, encoding="utf-8"))["events"]
    seen, per = set(), {k: {"events": [], "venues": [], "descs": []} for k in PROVS}
    vidx = {k: {} for k in PROVS}
    didx = {k: {} for k in PROVS}

    for e in raw:
        if e["id"] in seen or e.get("status") != "publish":
            continue
        seen.add(e["id"])
        names = [c["name"] for c in e.get("categories", [])]
        v = e["venue"] if isinstance(e.get("venue"), dict) else {}
        provs = [p for p in (prov_of(n) for n in names) if p]
        if not provs:
            p = prov_of(v.get("stateprovince") or v.get("province") or "")
            provs = [p] if p else []
        cats = sorted({CAT[slug(n)] for n in names if slug(n) in CAT})
        sn = [slug(n) for n in names]
        title = html.unescape(e["title"]).strip()
        if "entrenamiento controlado" in sn or "ENTRENAMIENTO CONTROLADO" in title.upper():
            ty = "entrenamiento"
        elif any(s.startswith("curso") for s in sn) or title.upper().startswith("CURSO"):
            ty = "curso"
        elif "sede" in sn or re.search(r"\bCTO\b|CAMPEONATO|COPA|LIGA|TECNIFICACI", title.upper()):
            ty = "oficial"
        else:
            ty = "tirada"
        desc, results = clean_desc(e.get("description", ""))
        org = e.get("organizer") or []
        org = org[0].get("organizer", "") if isinstance(org, list) and org else ""
        for p in provs:
            vi = None
            if v.get("venue"):
                key = v.get("id")
                if key not in vidx[p]:
                    vidx[p][key] = len(per[p]["venues"])
                    per[p]["venues"].append({
                        "n": html.unescape(v.get("venue", "")), "a": html.unescape(v.get("address", "") or ""),
                        "c": html.unescape(v.get("city", "") or "").title(), "ph": v.get("phone", "") or "", "k": 0})
                vi = vidx[p][key]
                per[p]["venues"][vi]["k"] += 1
            di = None
            if desc:
                if desc not in didx[p]:
                    didx[p][desc] = len(per[p]["descs"])
                    per[p]["descs"].append(desc)
                di = didx[p][desc]
            per[p]["events"].append({
                "id": e["id"], "t": title, "s": e["start_date"][:16].replace(" ", "T"),
                "e": e["end_date"][:16].replace(" ", "T"), "ad": bool(e.get("all_day")),
                "cat": cats, "ty": ty, "v": vi, "o": html.unescape(org), "u": e.get("url", ""),
                "d": di, "r": results})

    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M")
    summary = {}
    today = datetime.date.today().isoformat()
    for p, d in per.items():
        d["events"].sort(key=lambda x: (x["s"], x["t"]))
        payload = {"prov": p, "name": PROVS[p], "updated": stamp, **d}
        js = "window.FATO_DELEG = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
        (OUT / ("deleg-%s.js" % p)).write_text(js, encoding="utf-8")
        nxt = [x for x in d["events"] if x["s"][:10] >= today]
        summary[p] = {"total": len(d["events"]), "upcoming": len(nxt),
                      "next": {"t": nxt[0]["t"], "s": nxt[0]["s"]} if nxt else None,
                      "venues": len(d["venues"])}
        print(p, len(d["events"]), "competiciones,", len(nxt), "próximas,", len(d["venues"]), "recintos,",
              round(len(js) / 1024), "KB")
    (OUT / "deleg-resumen.js").write_text(
        "window.FATO_DELEG_SUM = " + json.dumps({"updated": stamp, "prov": summary}, ensure_ascii=False) + ";\n",
        encoding="utf-8")


if __name__ == "__main__":
    main()
