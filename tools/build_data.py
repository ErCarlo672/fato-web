"""Genera assets/js/data.js a partir de cal.json (calendario RFEDETO-FATO) y clubs_raw.json.
Uso: python tools/build_data.py assets/js/data.js"""
import json, re, sys, datetime, os

SCR = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]

# ---------- Events ----------
events = json.load(open(os.path.join(SCR, 'cal.json'), encoding='utf-8'))

LOCS = ["Burgas (Bulgaria)","Vera (Almería)","Naquera/Cheste","Las Gabias (Granada)","Camas (Sevilla)",
 "Náquera (Valencia)","El Pto. Sta. Mª (Cádiz)","El Puerto Sta. Mª (Cádiz)","Yerevan (Armenia)","Villa Nueva Gallegos",
 "Tanger (Marruecos)","Carmona (Sevilla)","El Cairo","Pilsen (Rep. Checa)","Osijek (Croacia)","Torres de Segre",
 "Almaty (Kazajistan)","Gádor (Almería)","As Pontes","Jarapalos (Málaga)","Chateauroux (Francia)","Todi (Italia)",
 "Rep. Checa","Media Naranja","Alcolea (Almería)","Bisley G.B.","Taranto (Italia)","Tallin (Estonia)","Santiago de Chile",
 "C. Valenciana","Porpetto (Italia)","Canto Blanco","Niw Taipei","Doha (Qatar)","Emiratos Arabes","Sant Cugat",
 "Las Gabias","Granada","Sevilla","Córdoba","Jaén","Almería","Carmona","Ruse","Munich","USA","Logroño","Tarrasa","Murcia",
 "Valladolid","Algarve","Naquera","Alicante","Mollet","Trasona","Zaragoza","Huesca","Extremadura","Elche","Elizondo",
 "Chiloeches","Amposta","Barcelona","Zamora","Francia","Alemania","Montsia","Sánsoain","Ensidesa","Parga","Polonia",
 "Entrego","Hungria","Toledo","Suhl","Tarragona","Santander","Korinthos","Grecia","Lonato","Bracara","Principado","Avila",
 "Somontes","Viveiro","China","Serbia","Eisenstadt","Sogito","Sabadell","Portugal","Aizoain","Atenas","Korea","Lisboa"]
LOCS.sort(key=len, reverse=True)

ANDALUS = {"Las Gabias":"Granada","Granada":"Granada","Camas":"Sevilla","Sevilla":"Sevilla","Carmona":"Sevilla",
 "Córdoba":"Córdoba","Jaén":"Jaén","Vera":"Almería","Gádor":"Almería","Alcolea":"Almería","Almería":"Almería",
 "El Pto":"Cádiz","El Puerto":"Cádiz","Jarapalos":"Málaga"}
FOREIGN = ["Ruse","Munich","USA","Burgas","Algarve","Yerevan","Tanger","El Cairo","Pilsen","Osijek","Almaty","Francia",
 "Alemania","Polonia","Chateauroux","Todi","Rep. Checa","Hungria","Suhl","Korinthos","Grecia","Lonato","Bracara","China",
 "Serbia","Bisley","Eisenstadt","Taranto","Tallin","Santiago de Chile","Portugal","Porpetto","Atenas","Korea","Lisboa",
 "Niw Taipei","Doha","Emiratos"]

def cats(raw):
    r = raw.lower()
    c = []
    if 'aa.hh' in r: c.append('historicas')
    if 'f-class' in r or 'fclass' in r: c.append('fclass')
    if re.search(r'br-50|prs|varmint|warmin', r): c.append('alta')
    if re.search(r'foso|skeet|trap|minifoso|mini foso|\bfo /|f\.o\.|f\.u\.', r): c.append('plato')
    if re.search(r'rrtt|rr\.tt|handgun|handgub|pcc|mini rifle|shotgun', r): c.append('recorridos')
    if re.search(r'10m|10 m|25|50m|300m|300 m|pistol|pist\.|carab|fusil|armas ol|armas dep|deportivas|jj\.?pp|tendido|libre|standard|std|aire|velocidad|training camp|tecnificaci', r) and not c:
        c.append('precision')
    if re.search(r'10/25/50|rifle pistola|pistola y carabina', r) and 'precision' not in c:
        c.append('precision')
    return c or ['precision']

out_ev = []
for e in events:
    raw = e['raw']
    if re.fullmatch(r'[LMXJVSD] \d+', raw):
        continue
    loc = next((l for l in LOCS if raw.startswith(l)), None)
    rest = raw[len(loc):].strip() if loc else raw
    if not loc:
        loc = raw.split(' ')[0]; rest = raw[len(loc):].strip()
    s = datetime.date.fromisoformat(e['start']); en = datetime.date.fromisoformat(e['end'])
    # Fix events whose end day did not exist in the inferred month (e.g. 27–29 Feb) -> next month
    if en == s and re.match(r'.*', raw) and e['start'].endswith(('-27','-28')) and s.month == 2:
        s = s.replace(month=3); en = s.replace(day=29)
    prov = next((v for k, v in ANDALUS.items() if loc.startswith(k)), None)
    foreign = any(loc.startswith(f) for f in FOREIGN)
    up = rest.upper()
    if re.search(r'ANDALUC|ANDALUZ|F\.A\.T\.O', up):
        scope = 'andalucia'
    elif foreign or re.search(r'WORLD|ISSF|MUNDO|EUROPA|EUROPE|GRAND PRIX|G\.P\.I|GPI|IB[EÉ]RIC|MEDITERR|IBEROAMERIC|CUP', up):
        scope = 'internacional'
    else:
        scope = 'nacional'
    out_ev.append({
        's': s.isoformat(), 'e': en.isoformat(), 'loc': loc, 'prov': prov,
        't': rest, 'cat': cats(raw), 'scope': scope,
        'x': bool(re.search(r'CANCELAD', up))
    })
out_ev.sort(key=lambda x: (x['s'], x['loc']))

# ---------- Clubs ----------
raw = json.load(open(os.path.join(SCR, 'clubs_raw.json'), encoding='utf-8'))
PROVN = {'almeria':'Almería','cadiz':'Cádiz','cordoba':'Córdoba','granada':'Granada','huelva':'Huelva','jaen':'Jaén','malaga':'Málaga','sevilla':'Sevilla'}
EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
PHONE = re.compile(r'(?<!\d)(?:\d[\s\-–]{0,3}){8}\d(?!\d)')
def title(s):
    small = {'de','del','la','las','el','los','y','al','a'}
    keep = {'C.D.','IPSC','RDM','D.V.C.','LAD','ACTOA','EADS','CASA','TOP','ATOS','C.A.M.O.R.R.A.','C.','T.','D.'}
    w = []
    for i, t in enumerate(s.split()):
        if t in keep or re.fullmatch(r'\(?[A-Z]{2,5}\)?', t) and t.strip('()') in {'ACTOA','TOP','ATOS','EADS','IPSC','RDM','LAD','CASA'}:
            w.append(t)
        elif t.lower() in small and i:
            w.append(t.lower())
        else:
            w.append(t[:1] + t[1:].lower())
    return ' '.join(w)
clubs = []
for k, arr in raw.items():
    for item in arr:
        parts = [p.strip() for p in item.split('|')]
        name = parts[0]
        body = ' | '.join(parts[1:])
        emails = EMAIL.findall(body)
        b2 = EMAIL.sub('', body)
        phones = [re.sub(r'[\s\-–]', '', p) for p in PHONE.findall(b2)]
        phones = [p[:3] + ' ' + p[3:6] + ' ' + p[6:] for p in phones]
        web = re.findall(r'www\.[\w.-]+', b2)
        addr_parts = []
        for p in parts[1:]:
            q = EMAIL.sub('', p)
            q = PHONE.sub('', q)
            q = re.sub(r'Tel[eé]fonos?:?', '', q)
            q = re.sub(r'www\.[\w.-]+', '', q)
            q = q.strip(' /|–-')
            if len(q) > 3: addr_parts.append(q)
        clubs.append({'n': title(name), 'p': PROVN[k], 'a': ' · '.join(addr_parts), 'ph': phones, 'em': emails, 'w': web[0] if web else ''})

data = {'events': out_ev, 'clubs': clubs, 'updated': '2026-06-08'}
js = '/* Datos generados a partir del calendario oficial RFEDETO-FATO 2026 (v. 08-06-2026) y del directorio de clubes de fato.es */\nwindow.FATO_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(OUT, 'w', encoding='utf-8').write(js)
print(len(out_ev), 'events;', len(clubs), 'clubs')
from collections import Counter
print(Counter(e['scope'] for e in out_ev)); print(Counter(c for e in out_ev for c in e['cat']))
