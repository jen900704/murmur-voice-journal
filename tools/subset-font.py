"""Build fonts/murmur-round.woff2: jf open huninn (justfont, SIL OFL 1.1) cut down to the
characters the app's own text uses, so the interface font stays small enough to work offline.

Under the OFL a subset is a modified version, so it carries its own name ("Murmur Round")
and keeps the original copyright notice; fonts/OFL-jf-open-huninn.txt is the licence.

Usage:
  git clone --depth 1 https://github.com/justfont/open-huninn-font /tmp/open-huninn-font
  pip install fonttools brotli
  python3 tools/subset-font.py /tmp/open-huninn-font/font/jf-openhuninn-2.1.ttf

Run it again after adding interface text with characters the font does not have yet.
The person's own writing is shown in the system font, so it never depends on this subset.
"""

import glob
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/open-huninn-font/font/jf-openhuninn-2.1.ttf'
OUT = 'fonts/murmur-round.woff2'

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set('，。、；：？！「」『』（）《》〈〉…～・—–→↗')
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
        rec.string = 'Murmur Round'
    elif rec.nameID == 6:
        rec.string = 'MurmurRound-Regular'
    elif rec.nameID == 3:
        rec.string = 'Murmur Round; subset of jf open huninn for Murmur'
font.flavor = 'woff2'
font.save(OUT)
print(OUT, len(chars), 'characters')
