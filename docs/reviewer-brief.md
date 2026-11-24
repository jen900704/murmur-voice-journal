# Murmur: a brief for a clinical reviewer

This page is for a supervisor or faculty member asked to look over Murmur before it is shared more widely. It takes about ten minutes to read. The full Chinese text of every exercise and bedtime script, with checkboxes, is in [`content-review.md`](content-review.md).

## What it is

A free web app, made by a clinical mental health counseling student, for adults in Taiwan and the US. It runs entirely in the browser; there are no accounts and no server. It has four parts:

1. **Voice journal.** The person speaks for about 30 seconds. The app measures pitch, pitch movement, speaking rate, pauses and voice regularity on the device, and compares each day only with the person's own earlier recordings. It does not screen, score or diagnose.
2. **"Look at it from another angle" (換個角度看看).** The person writes a worry, picks a topic, and answers three or four questions in the style of one of 14 approaches covered in Corey's *Theory and Practice of Counseling and Psychotherapy* (psychoanalytic through family systems). Each exercise ends with what the approach noticed, a small experiment for the week, and what the approach might miss. It is framed as self-reflection, not counseling.
3. **Bedtime ritual.** Set a worry down (optional), note one kind thing done for oneself, and listen to a three to four minute wind-down track in the spirit of one of nine approaches, read by the phone's own voice. A pastel postcard at the end.
4. **Small supports.** A one-minute breathing pacer, a private "kindness jar", three small general actions on low days, a curated list of gentle films and books with content notes, and ways to share a postcard or a daily prompt with one person through the phone's share sheet.

An experimental AI conversation, off by default and needing the person's own API key, can continue an exercise in the same approach.

## How the content was kept within self-help limits

- Only techniques reasonable to try alone are used. Empty chair, exposure, and anything that relies on a therapeutic relationship are left out, and each lens says so in its "might miss" note.
- Approaches poorly suited to grief (Adlerian, existential, Gestalt, REBT, cognitive, behavioral, reality, solution-focused, narrative) are not offered when the topic is loss.
- Wording was reviewed several times for blame and pathologizing. Examples of changes: the Adlerian summary says outright that being hurt by others is not a flaw in how one copes; the Gestalt "I choose" step says it can be skipped when something is being done to you; bedtime tracks do not ask evaluative questions at night.
- The psychoanalytic bedtime track ("letting images drift up") gives its way out first (open your eyes, name three things in the room, feel the bed), interprets nothing, is never chosen at random, and carries a note to pick another track on a heavy night.
- The AI conversation is limited per approach (allowed moves and moves to avoid), never diagnoses or discusses medication, does not question reports of abuse or threats, does not flatter or reassure, ends after ten turns with a summary and no question, and stops with help lines if risk appears on either side.

## Safety design

- **Risk language.** Every free-text field that is stored or shared is checked for suicide, self-harm, harm to others and abuse, in Traditional Chinese and English, against about 210 test phrases (direct and indirect wording, and ordinary phrases that should not match, such as 累死了 or "this deadline is killing me"). A match pauses and shows help lines. Nothing written is deleted, and the person can say it meant something else and carry on. This is a coarse safety net, not a classifier, and it will miss some wording.
- **Help lines** are one tap away on every screen, shown for the person's region: Taiwan (1925, 1995, 113, 110, 119, and 1980 marked as not 24 hours), the US (988, the domestic violence hotline, 911), or elsewhere (findahelpline.com).
- **No social comparison.** No feeds, likes, counts, streaks or leaderboards. Sharing goes to one chosen person at a time, outside the app.
- **Privacy.** Everything stays on the device unless the person shares it. Bedtime speech uses on-device voices only, because online voices would send the script to a server.

## Evidence for the voice measures

A preregistered comparison with Praat on recorded English speech, a preregistered robustness study (phone codecs, volume, noise, reverberation), and a small exploratory Mandarin pilot. Pitch agrees closely with Praat; some measures (pitch range, syllable counts, voicing coverage) missed their preset thresholds and are labelled with lower confidence in the app. Details are in the README and `validation-results.md`.

## What we would most like a reviewer to check

1. Do the lens questions and bedtime scripts fit how each approach is taught, and is anything unsafe to do alone? (`content-review.md`)
2. Is the crisis wording and the help-line list right for Taiwan?
3. Should the app carry the student's name, and should the program or site supervisor know before it is shared?
4. Anything that could read as counseling, or that a person might mistake for professional care.
