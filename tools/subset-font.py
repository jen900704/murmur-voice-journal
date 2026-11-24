"""Build the bundled fonts, each cut down to the characters the app's own text uses so they
stay small enough to work offline:
  fonts/murmur-round.woff2  from jf open huninn (justfont, SIL OFL 1.1): interface text
  fonts/murmur-black.woff2  from Noto Sans TC Black (Google/Adobe, SIL OFL 1.1): big titles and numerals

Under the OFL a subset is a modified version, so it carries its own name ("Murmur Round")
and keeps the original copyright notice; fonts/OFL-jf-open-huninn.txt is the licence.

Usage:
  git clone --depth 1 https://github.com/justfont/open-huninn-font /tmp/open-huninn-font
  curl -LO https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/TC/NotoSansTC-Black.otf
  pip install fonttools brotli
  python3 tools/subset-font.py /tmp/open-huninn-font/font/jf-openhuninn-2.1.ttf
  python3 tools/subset-font.py NotoSansTC-Black.otf "Murmur Black" fonts/murmur-black.woff2

Run it again after adding interface text with characters the font does not have yet.
The person's own writing is shown in the system font, so it never depends on this subset.
"""

import glob
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/open-huninn-font/font/jf-openhuninn-2.1.ttf'
FAMILY = sys.argv[2] if len(sys.argv) > 2 else 'Murmur Round'
OUT = sys.argv[3] if len(sys.argv) > 3 else 'fonts/murmur-round.woff2'

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set('，。、；：？！「」『』（）《》〈〉…～・—–→↗')
# Murmur Black also sets the person's own line on the keepsake card, so it carries the 5,401
# common characters of Big5 (tools/big5-common.txt) as well, to avoid mixed weights in a line.
if 'Black' in FAMILY:
    with open('tools/big5-common.txt', encoding='utf8') as f:
        chars |= set(f.read())
for path in glob.glob('js/**/*.js', recursive=True) + ['index.html', 'manifest.webmanifest']:
    with open(path, encoding='utf8') as f:
        chars |= set(f.read())

opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
font = TTFont(SRC)
sub = subset.Subsetter(opts)
sub.populate(text=''.join(sorted(chars)))
sub.subset(font)

for rec in font['name'].names:
    if rec.nameID in (1, 4, 16, 18):
        rec.string = FAMILY
    elif rec.nameID == 6:
        rec.string = FAMILY.replace(' ', '') + '-Regular'
    elif rec.nameID == 3:
        rec.string = f'{FAMILY}; subset made for Murmur'
font.flavor = 'woff2'
font.save(OUT)
print(OUT, len(chars), 'characters')
