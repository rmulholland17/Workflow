# Geocodes every business in search.html's embedded DATA with the free US
# Census batch geocoder (no API key), for the No-Site Finder map.
# Output: research/geocode.json  {place_id: [lat, lng, exact(1|0)]}
# exact=0 means the Census couldn't match the street address and the point
# is the average of matched businesses in the same ZIP (approximate).
#
# Usage (from businesses-with-no-website/): python3 research/geocode.py
import csv, io, json, re, subprocess, sys, collections

SRC = "search.html"
OUT = "research/geocode.json"
URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
CHUNK = 1000

html = open(SRC, encoding="utf-8").read()
line = next(l for l in html.split("\n") if l.startswith("const DATA = "))
data = json.loads(line[len("const DATA = "):].rstrip().rstrip(";"))

try:
    done = json.load(open(OUT))
except FileNotFoundError:
    done = {}

def split_addr(a):
    m = re.match(r"^(.*), ([^,]+), CA (\d{5})$", a)
    return m.groups() if m else (a, "", "")

todo = [r for r in data if r["id"] not in done or done[r["id"]][2] == 0]
print(f"{len(data)} businesses, {len(todo)} to geocode", file=sys.stderr)

for i in range(0, len(todo), CHUNK):
    part = todo[i:i + CHUNK]
    buf = io.StringIO()
    w = csv.writer(buf)
    for r in part:
        street, city, zp = split_addr(r["a"])
        w.writerow([r["id"], street, city, "CA", zp])
    res = subprocess.run(
        ["curl", "-s", "--max-time", "600", "-F", "addressFile=@-;filename=a.csv",
         "-F", "benchmark=Public_AR_Current", URL],
        input=buf.getvalue().encode(), capture_output=True)
    n = 0
    for row in csv.reader(io.StringIO(res.stdout.decode("utf-8", "replace"))):
        if len(row) >= 6 and row[2] == "Match" and row[5]:
            lng, lat = map(float, row[5].split(","))
            done[row[0]] = [round(lat, 5), round(lng, 5), 1]
            n += 1
    print(f"  chunk {i // CHUNK + 1}: {n}/{len(part)} matched", file=sys.stderr)
    json.dump(done, open(OUT, "w"))

# ZIP-centroid fallback for anything the Census couldn't match.
by_zip = collections.defaultdict(list)
for r in data:
    p = done.get(r["id"])
    if p and p[2] == 1:
        by_zip[split_addr(r["a"])[2]].append(p)
miss = 0
for r in data:
    p = done.get(r["id"])
    if p and p[2] == 1:
        continue
    pts = by_zip.get(split_addr(r["a"])[2])
    if pts:
        done[r["id"]] = [round(sum(p[0] for p in pts) / len(pts), 5),
                         round(sum(p[1] for p in pts) / len(pts), 5), 0]
    else:
        done.pop(r["id"], None)
        miss += 1
json.dump(done, open(OUT, "w"))
exact = sum(1 for v in done.values() if v[2] == 1)
print(f"done: {exact} exact, {len(done) - exact} ZIP-approx, {miss} no location", file=sys.stderr)
