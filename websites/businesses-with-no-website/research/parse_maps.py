import re
import sys

def parse(path):
    text = open(path, encoding="utf-8").read()
    # split into article blocks
    blocks = re.split(r'\n(?=\s*- article \[ref=)', text)
    results = []
    for b in blocks:
        m = re.search(r'- link "([^"]+)" \[ref=\S+\][^\n]*\n\s*- /url: (https://www\.google\.com/maps/place/\S+)', b)
        if not m:
            continue
        name, url = m.group(1), m.group(2)
        rating_m = re.search(r'img "([\d.]+) stars ([\d,]+) Reviews"', b)
        rating = f"{rating_m.group(1)}({rating_m.group(2)})" if rating_m else ""
        phone_m = re.search(r'· \((\d{3}\) \d{3}-\d{4})', b)
        phone = f"({phone_m.group(1)}" if phone_m else ""
        # address: generic line right after category, starting with '· ' but not phone-like
        addr_m = re.search(r'- generic: · ([^\n(][^\n]*)\n', b)
        addr = addr_m.group(1).strip() if addr_m else ""
        has_website = bool(re.search(r"Visit .*'s website", b)) or bool(re.search(r'link "Visit ', b))
        is_sponsored = 'heading "Sponsored"' in b
        results.append({
            "name": name,
            "url": url,
            "rating": rating,
            "phone": phone,
            "addr": addr,
            "has_website": has_website,
            "sponsored": is_sponsored,
        })
    return results

if __name__ == "__main__":
    path = sys.argv[1]
    for r in parse(path):
        flag = "SPONSORED" if r["sponsored"] else ("HAS_SITE" if r["has_website"] else "NO_SITE")
        print(f"{flag} | {r['name']} | {r['rating']} | {r['phone']} | {r['addr']} | {r['url']}")
