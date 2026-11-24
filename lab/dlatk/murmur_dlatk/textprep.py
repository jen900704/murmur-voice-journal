"""Text normalization applied before either engine sees a message, and the fallback tokenizer.

normalize() is applied when the message table is built, so DLATK and the fallback read the
same strings. tokenize() is an independent implementation written for this project. It is
meant to agree with DLATK's default tokenizer on ordinary prose; it does not reproduce every
special case (phone numbers, HTML tags, unusual emoticons). The runner measures the actual
agreement on your data whenever DLATK is available (parity.json).
"""
import html
import re
import unicodedata

_URL = re.compile(r"(?:https?://|www\.)\S+", re.I)
_EMAIL = re.compile(r"\b[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+\b")
_CJK = re.compile(r"([㐀-䶿一-鿿豈-﫿぀-ヿ㄀-ㄯ가-힯])")
_SPACE = re.compile(r"\s+")


def normalize(text):
    """NFKC, HTML entities decoded, URLs and e-mail addresses replaced by <url> and <email>,
    each CJK character set apart by spaces (so n-grams over Chinese are character n-grams),
    and all whitespace, including line breaks, collapsed to single spaces."""
    s = unicodedata.normalize("NFKC", html.unescape(str(text)))
    s = _URL.sub(" <url> ", s)
    s = _EMAIL.sub(" <email> ", s)
    s = _CJK.sub(r" \1 ", s)
    return _SPACE.sub(" ", s).strip()


_TOKEN = re.compile(r"""
      <(?:url|email)>                                   # placeholders from normalize()
    | [<>]?[:;=8>][\-o*']?[)\](\[dpx/:}{@|\\]          # emoticon, eyes first  :) ;-p
    | [)\](\[dpx/:}{@|\\][\-o*']?[:;=8<][<>]?          # emoticon, mouth first (:
    | <[/\\]?3                                          # heart
    | @\w+                                              # mention
    | \#+\w[\w'\-]*\w                                   # hashtag
    | \w[\w'\-]+\w                                      # word, may hold ' or - inside
    | [+\-]?\d+[,/.:\-]\d+[+\-]?                        # number with one separator
    | \w+
    | \.(?:\s*\.)+                                      # run of dots
    | \S
""", re.X)


def tokenize(text):
    """Lowercased tokens of an already normalized message."""
    return _TOKEN.findall(text.lower())


def ngrams(tokens, n):
    """Space-joined n-grams within one message (n-grams never cross messages)."""
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]
