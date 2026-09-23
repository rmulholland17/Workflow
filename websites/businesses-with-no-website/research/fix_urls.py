import re

path = "/private/tmp/claude-501/-Users-rileymulholland-Desktop/e33af28b-a55b-4e87-bb03-95654c270783/scratchpad/sd-directory.html"

full_urls = [
"https://www.google.com/maps/place/San+Diego+Best+Heating+and+AC+Pros/@0,0,15z/data=!3m1!4b1!4m3!3m2!1s0x80dc016faf6e88bf:0x7fc66d76f205c203!16s%2Fg%2F11f5vc295x?entry=ttu",
"https://www.google.com/maps/place/Pacific+Beach+Electric/data=!4m7!3m6!1s0x80dc019441653ae5:0x43e2b0d5f2d41481!8m2!3d32.802398!4d-117.2482807!16s%2Fg%2F1tf4fb2v!19sChIJ5TplQZQB3IARgRTU8tWw4kM",
"https://www.google.com/maps/place/E-on+Electric/data=!4m7!3m6!1s0x80deab1b6589a4fb:0xdaaf239be68649e6!8m2!3d32.7685594!4d-117.2002027!16s%2Fg%2F11myldnk2_!19sChIJ-6SJZRur3oAR5kmG5psjr9o",
"https://www.google.com/maps/place/Elite+Ridge+Roofing+Service/data=!4m7!3m6!1s0x80dc01a232f6b5e9:0xeb01b90d1d35111f!8m2!3d32.8128816!4d-117.2016978!16s%2Fg%2F11nc2_8d30!19sChIJ6bX2MqIB3IARHxE1HQ25Aes",
"https://www.google.com/maps/place/Colin%27s+Emergency+Roofers/data=!4m7!3m6!1s0x80d95564e63ed517:0x4a9f9253e2f08c9d!8m2!3d32.7991122!4d-117.0926165!16s%2Fg%2F11jbk8rqbc!19sChIJF9U-5mRV2YARnYzw4lOSn0o",
"https://www.google.com/maps/place/Anatoli%27s+Handyman+Service,+LLC/data=!4m7!3m6!1s0x80deab98942f2d0f:0x7d269743be7845bb!8m2!3d32.7494805!4d-117.2247874!16s%2Fg%2F11fwc10380!19sChIJDy0vlJir3oARu0V4vkOXJn0",
"https://www.google.com/maps/place/Handymen+Plus/data=!4m7!3m6!1s0x80dc01ea1f807cbf:0xc917cd6ee810c23!8m2!3d32.7943647!4d-117.2455749!16s%2Fg%2F11c1vj5ttm!19sChIJv3yAH-oB3IARIwyB7tZ8kQw",
"https://www.google.com/maps/place/Easy+Go+Services/data=!4m7!3m6!1s0x80dc01534369764b:0x8ec67f2b5abecbde!8m2!3d32.7997184!4d-117.2511449!16s%2Fg%2F11xs09wp0_!19sChIJS3ZpQ1MB3IAR3su-Wit_xo4",
"https://www.google.com/maps/place/JRM+Handyman+Services/data=!4m7!3m6!1s0x80dc017efd01d6b1:0x458e64841d3cda95!8m2!3d32.8146282!4d-117.1919468!16s%2Fg%2F11jz44lv84!19sChIJsdYB_X4B3IARldo8HYRkjkU",
"https://www.google.com/maps/place/SAN+DIEGO+CLEANING/data=!4m7!3m6!1s0x80dc014c81fcaedd:0x1f6db9f29fb41f3b!8m2!3d32.793297!4d-117.232831!16s%2Fg%2F11lv8ytvdw!19sChIJ3a78gUwB3IAROx-0n_K5bR8",
"https://www.google.com/maps/place/Pacific+Beach+Pressure+Washing+Pros/data=!4m7!3m6!1s0x80dc01b554d847a7:0xa9550d4ba93a8fd!8m2!3d32.7880427!4d-117.2380413!16s%2Fg%2F11np74nfqq!19sChIJp0fYVLUB3IAR_aiTutRQlQo",
"https://www.google.com/maps/place/We+Haul+You/data=!4m7!3m6!1s0x80deab6e4f16953d:0xdbab0c301c10cd5e!8m2!3d32.8055759!4d-117.219323!16s%2Fg%2F11f650ks7w!19sChIJPZUWT26r3oARXs0QHDAMq9s",
"https://www.google.com/maps/place/Hard+Hauling+%26+Junk+Solutions/data=!4m7!3m6!1s0xa99221e868a6bf95:0xb5a5a09273ec4ed1!8m2!3d32.8060491!4d-117.2429948!16s%2Fg%2F11zxfbd57_!19sChIJlb-maOghkqkR0U7sc5KgpbU",
"https://www.google.com/maps/place/Coastal+Tree+Work/data=!4m7!3m6!1s0x4ba65f212c2807dd:0x40460c41ee4f75c1!8m2!3d32.7462888!4d-117.1856509!16s%2Fg%2F11mkvzmp2f!19sChIJ3QcoLCFfpksRwXVP7kEMRkA",
"https://www.google.com/maps/place/Bz+Pool+Service/data=!4m7!3m6!1s0x80deaa513cfa327d:0xa466fd7984dfcf8d!8m2!3d32.7480107!4d-117.2277075!16s%2Fg%2F1th6f4g9!19sChIJfTL6PFGq3oARjc_fhHn9ZqQ",
"https://www.google.com/maps/place/San+Diego+Garage+Door+Repair/data=!4m7!3m6!1s0x80dc01654d7f0aef:0xcc2eeaac89c6bfd5!8m2!3d32.78082!4d-117.253213!16s%2Fg%2F11lnqhp0yb!19sChIJ7wp_TWUB3IAR1b_GiazqLsw",
"https://www.google.com/maps/place/LaJolla+Garage+Door+Repair+Service/data=!4m7!3m6!1s0x80dc01a041ccdb79:0x7cc029aca06fa6c8!8m2!3d32.8167917!4d-117.2547371!16s%2Fg%2F11z7cm8n9c!19sChIJedvMQaAB3IARyKZvoKwpwHw",
"https://www.google.com/maps/place/Blueline+Mobile+Car+Detailing+of+San+Diego/data=!4m7!3m6!1s0x80deaba0b83ca3ad:0x53104dc2632f6511!8m2!3d32.7479255!4d-117.21404!16s%2Fg%2F11z1w7r2zw!19sChIJraM8uKCr3oAREWUvY8JNEFM",
"https://www.google.com/maps/place/Performance+Custom+Drywall/data=!4m7!3m6!1s0x80dc01075d10db25:0x5165647de86324d2!8m2!3d32.8073939!4d-117.2551027!16s%2Fg%2F1tfxy9z6!19sChIJJdsQXQcB3IAR0iRj6H1kZVE",
"https://www.google.com/maps/place/7+Star+Mobile+Auto+Repair/data=!4m7!3m6!1s0x80d95574abbe1457:0x440238885d7421de!8m2!3d32.7802873!4d-117.1709415!16s%2Fg%2F11zd6_fmx9!19sChIJVxS-q3RV2YAR3iF0XYg4AkQ",
"https://www.google.com/maps/place/THE+CHIMNEY+RELINING+COMPANY,+LLC/data=!4m7!3m6!1s0x80dc01c73edc0859:0x4072d361878c98a5!8m2!3d32.7995373!4d-117.2394221!16s%2Fg%2F11n4qv73wp!19sChIJWQjcPscB3IARpZiMh2HTckA",
"https://www.google.com/maps/place/JRP+Plastering+%26+Stucco/data=!4m7!3m6!1s0x80dc00deaaaaaaab:0x6223c571591dbed5!8m2!3d32.8563846!4d-117.2029363!16s%2Fg%2F1vxcwq9g!19sChIJq6qqqt4A3IAR1b4dWXHFI2I",
"https://www.google.com/maps/place/Progressive+Tints/data=!4m7!3m6!1s0x80dc01b89fa317b3:0xad58fc6f3c709ae6!8m2!3d32.8016561!4d-117.2365803!16s%2Fg%2F11c1ndpwwm!19sChIJsxejn7gB3IAR5ppwPG_8WK0",
"https://www.google.com/maps/place/Jake%27s+Spa+Service+and+Repair,+LLC/data=!4m7!3m6!1s0xaf9358783f695df5:0xe5ab1ef17286366d!8m2!3d32.7265698!4d-117.2288965!16s%2Fg%2F11q25s4zcj!19sChIJ9V1pP3hYk68RbTaGcvEeq-U",
"https://www.google.com/maps/place/Sunset+Landscaping+%26+Maintenance/data=!4m7!3m6!1s0x80d954449b9c5f01:0x9ba208f819865222!8m2!3d32.8244879!4d-117.10776!16s%2Fg%2F11cn7g69hx!19sChIJAV-cm0RU2YARIlKGGfgIops",
"https://www.google.com/maps/place/Gonzalez/@32.835129,-117.063981,10z/data=!3m1!4b1!4m6!3m5!1s0x80dbf9fe6b4a1b61:0x9dd12c0fa46ac0b0!8m2!3d32.835129!4d-117.063981!16s%2Fg%2F11r1y722g5",
"https://www.google.com/maps/place/%E2%80%8BSan+Diego+Small+Moves/data=!4m7!3m6!1s0x80dbffdc74ba47bd:0x29291aecde4dc96c!8m2!3d32.9173924!4d-117.1470654!16s%2Fg%2F1hd_km2y2!19sChIJvUe6dNz_24ARbMlN3uwaKSk",
"https://www.google.com/maps/place/Lisa+Davis+Upholstery/data=!4m7!3m6!1s0x80d95454fc3fb805:0xce026c40efc8e2e4!8m2!3d32.8262767!4d-117.228616!16s%2Fg%2F11bvt2wspm!19sChIJBbg__FRU2YAR5OLI70BsAs4",
"https://www.google.com/maps/place/AB+Auto+Upholstery/data=!4m7!3m6!1s0x80dbff98f79e403d:0x5ec92aed182ecd55!8m2!3d32.8356026!4d-117.1513648!16s%2Fg%2F1tfx55f1!19sChIJPUCe95j_24ARVc0uGO0qyV4",
"https://www.google.com/maps/place/Custom+Awning+%26+Canvas/data=!4m7!3m6!1s0x80d954f140a16e13:0x4565ef506fae3004!8m2!3d32.7486068!4d-117.1335413!16s%2Fg%2F1vs1s4zz!19sChIJE26hQPFU2YARBDCub1DvZUU",
]

with open(path, encoding="utf-8") as f:
    lines = f.readlines()

start_line = 369  # 1-indexed
idx = 0
for i in range(start_line-1, start_line-1+30):
    line = lines[i]
    new_url = full_urls[idx]
    idx += 1
    new_line = re.sub(r'maps:"[^"]*"', 'maps:"' + new_url + '"', line)
    if new_line == line:
        print("WARNING: no substitution on line", i+1)
    lines[i] = new_line

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Replaced", idx, "urls")
