# Privacy

Murmur has no server, no account, no analytics and no third-party requests. This page lists exactly what is stored and where.

## Stored on your device

| What | Where | How to remove |
|---|---|---|
| Voice measurements, check-ins, notes | IndexedDB `murmur` | About → Delete everything |
| Recordings (only if you keep them) | IndexedDB `murmur` | Delete one entry, or everything |
| 換角度 sessions: worry, topics, answers, ratings, heaviness before and after, plans | IndexedDB `murmur` | Delete one in Saved, or everything |
| Bedtime nights, kind things | IndexedDB `murmur` | Same |
| Language mirror texts and imports | IndexedDB `murmur-langlab` | Delete in the mirror, or everything |
| Optional learner's decision log | IndexedDB `murmur` (settings) | Delete everything |
| Language and other settings | IndexedDB `murmur` (settings) | Delete everything |
| Help-line region, calm-voice switch, dismissed notes | localStorage keys starting with `murmur-` | Delete everything |
| AI conversation key (only if you add one) | IndexedDB `murmur` (settings), unencrypted | Delete everything |

Backups you export are unencrypted JSON files and contain your text. Keep them somewhere private.

## What can leave the device

- **Nothing**, unless you choose one of these:
- **Sharing a card or postcard**: only the image, through your phone's share sheet.
- **The AI conversation** (off by default): that conversation, the worry and the answers of that one exercise, sent to the provider you chose, with your own key. Voice and bedtime data are never sent.
- **The prompt exchange link**: only the prompt's number, plus an answer if you choose to share it.

## The research modules

`lab/` and `infra/` are for studying the app. They run on scripted or synthetic data and public research datasets, and never receive anyone's journal.
