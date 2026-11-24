"""Builds the synthetic example export. Every sentence here is made up; no real person's
text is involved. A relation between wording and the mood rating is built in on purpose
(low weeks use more words like "tired" and "worried"), so that the example has something
to find. Run:  python3 examples/make_synthetic.py
"""
import json
import os
import random
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(20261124)

NEUTRAL = [
    "Worked from the library in the afternoon and answered email after dinner.",
    "Laundry, groceries, and a long call with my sister about her move.",
    "The bus was late again so I read on the way to class.",
    "Made rice and eggs for dinner and watched one episode before bed.",
    "Meeting in the morning, then I cleaned my desk and sorted my notes.",
    "It rained most of the day and I stayed in with tea.",
    "I wrote two pages of the report and I still have the tables to do.",
    "Cooked with my roommate and we talked about the summer.",
    "今天 在 圖書館 寫 報告 , 晚上 煮 了 麵 。".replace(" ", ""),
    "下午 開會 , 回家 以後 洗 衣服 。".replace(" ", ""),
]
LOW = [
    "I am tired and I can't focus on anything today.",
    "Worried about the deadline and I didn't sleep well.",
    "I feel behind on everything and I am too tired to start.",
    "Couldn't sleep, kept thinking about the review, I am worried I will fail.",
    "Nothing went right today and I don't want to talk to anyone.",
    "I skipped lunch again and I am tired of feeling this slow.",
    "我 今天 很 累 , 不 想 說話 。".replace(" ", ""),
]
HIGH = [
    "Went for a walk with a friend and it was a good afternoon.",
    "Slept well and the morning felt easy, I got a lot done.",
    "A good call with my friend, we laughed a lot.",
    "I finished the draft and I am happy with how it reads.",
    "Long walk by the river after class, the light was beautiful.",
    "My friend cooked for us and it was a calm, good evening.",
    "今天 跟 朋友 去 散步 , 很 開心 。".replace(" ", ""),
]
WORRIES = ["The deadline next week and whether my draft is good enough.", "I keep replaying what I said in the meeting.",
           "Money this month and the rent going up.", "Whether I am doing enough for my family from this far away."]
KIND = ["Made myself a warm dinner.", "Took a walk before it got dark.", "Went to bed before midnight.",
        "Called a friend back.", "泡了一杯熱茶"]
POSTS = ["Finally a sunny day, walking to campus :)", "Does anyone else get nothing done on Mondays?",
         "New semester, new notebook. https://example.com/notebook", "So tired this week... coffee is not helping",
         "Good dinner with good people tonight #grateful", "Rain again. Tea again."]


def main():
    start = datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc)   # a Monday
    entries, nights, sessions, posts = [], [], [], []
    level = 4.0
    for week in range(20):
        level = min(6.0, max(2.0, level + rng.choice([-1.0, -0.5, 0.0, 0.5, 1.0])))
        for day in range(7):
            when = start + timedelta(weeks=week, days=day, minutes=rng.randint(0, 480))
            ms = int(when.timestamp() * 1000)
            mood = int(min(7, max(1, round(level + rng.gauss(0, 0.8)))))
            energy = int(min(7, max(1, round(level + rng.gauss(0, 1.2)))))
            p_low, p_high = min(0.9, max(0.05, (4.5 - mood) / 3.0)), min(0.9, max(0.05, (mood - 3.5) / 3.0))
            parts = [rng.choice(NEUTRAL)]
            if rng.random() < p_low:
                parts.append(rng.choice(LOW))
            if rng.random() < p_high:
                parts.append(rng.choice(HIGH))
            if day != 6:   # one day a week has no entry
                entries.append({"id": "synthetic-e-%03d" % len(entries), "createdAt": ms, "prompt": "", "lang": "en",
                                "mood": mood, "energy": energy, "note": " ".join(parts), "demo": False,
                                "features": None, "silent": True, "featureVersion": 2, "hasAudio": False, "capture": None})
            if day in (1, 4):
                nights.append({"id": "synthetic-n-%03d" % len(nights), "createdAt": ms + 8 * 3600 * 1000, "theme": "work",
                               "worry": rng.choice(WORRIES), "kindness": rng.choice(KIND), "track": "relaxation",
                               "seed": "synthetic", "lang": "en"})
            if day == 3 and week % 2 == 0:
                sessions.append({"id": "synthetic-s-%03d" % len(sessions), "createdAt": ms + 3600 * 1000, "lensId": "solution-focused",
                                 "topic": "work", "concern": rng.choice(WORRIES),
                                 "answers": ["A time it went a little better was when I started with the smallest part.", 2,
                                             "One small step would be to write for ten minutes before email."], "rating": 4})
            if day in (2, 5):
                posts.append({"text": rng.choice(POSTS), "timestamp": (when + timedelta(hours=5)).isoformat().replace("+00:00", "Z"),
                              "source": "example-network"})
    export = {"app": "murmur", "version": 1, "synthetic": True,
              "note": "SYNTHETIC EXAMPLE. Every entry was generated by lab/dlatk/examples/make_synthetic.py. Do not import into the app.",
              "exportedAt": "2026-11-24T00:00:00.000Z", "entries": entries, "nights": nights, "lensSessions": sessions, "lensStats": {}}
    with open(os.path.join(HERE, "synthetic-export.json"), "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(os.path.join(HERE, "synthetic-posts.json"), "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("%d entries, %d nights, %d lens sessions, %d posts" % (len(entries), len(nights), len(sessions), len(posts)))


if __name__ == "__main__":
    main()
