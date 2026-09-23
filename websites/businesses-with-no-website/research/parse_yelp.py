import re
import sys

def parse(path):
    text = open(path, encoding="utf-8").read()
    no_results = 'No results found for site:yelp.com' in text
    slug_m = re.search(r'https://www\.yelp\.com\s*(?:›|\\u203a)\s*biz\s*(?:›|\\u203a)\s*([a-z0-9\-]+)', text)
    if not slug_m:
        return None, None, None, no_results
    slug = slug_m.group(1)
    start = slug_m.end()
    window = text[start:start+2000]
    rating_m = re.search(r'Rated ([\d.]+) out of 5, \(([\d,]+)\) user reviews', window)
    rating = f"{rating_m.group(1)}({rating_m.group(2)})" if rating_m else ""
    heading_m = re.search(r'heading "([^"]+)"', text[max(0,slug_m.start()-800):slug_m.start()])
    heading = heading_m.group(1) if heading_m else ""
    return slug, rating, heading, no_results

if __name__ == "__main__":
    path = sys.argv[1]
    slug, rating, heading, no_results = parse(path)
    if slug:
        confidence = "LOOSE_MATCH(no_exact_results)" if no_results else "EXACT_MATCH"
        print(f"YELP_FOUND | https://www.yelp.com/biz/{slug} | {rating} | {confidence} | heading={heading}")
    else:
        print("YELP_NOT_FOUND")
