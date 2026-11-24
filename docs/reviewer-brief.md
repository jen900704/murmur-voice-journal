# Murmur: a brief for a clinical reviewer

This page is for a supervisor or faculty member asked to look over Murmur before it is shared more widely. It takes about ten minutes to read. The full Chinese text of every exercise and bedtime script, with checkboxes, is in [`content-review.md`](content-review.md).

## What it is

A free web app, made by a clinical mental health counseling student, for adults in Taiwan and the US. It runs entirely in the browser; there are no accounts and no server. It has four parts:

1. **Voice journal.** The person speaks for about 30 seconds. The app measures pitch, pitch movement, speaking rate, pauses and voice regularity on the device, and compares each day only with the person's own earlier recordings. When speaking aloud is not possible, mood, energy and a one-line note can be logged without a recording. It does not screen, score or diagnose.
2. **"Look at it from another angle" (換個角度看看).** The person writes a worry, picks a topic, chooses an approach (a random draw, a comparison of three, or a short list ordered by topic), and answers three or four questions in the style of one of 14 approaches covered in Corey's *Theory and Practice of Counseling and Psychotherapy* (psychoanalytic through family systems). Each exercise ends with what the approach noticed, a small experiment for the week, key ideas, and what the approach might miss. An answer such as "not sure" is accepted and is not quoted back. It is framed as self-reflection, not counseling.
3. **Bedtime ritual.** Set a worry down (optional), note one kind thing done for oneself, and listen to one of nine wind-down tracks of about three to five minutes, each in the spirit of a counseling approach, read by the phone's own voice or shown as read-along text. A pastel postcard at the end. The ritual is shown in dark colors, and from 8 pm to 4 am its card comes first on the Today screen.
4. **Small supports.** A one-minute breathing pacer, a private "kindness jar", up to three small general actions after a low mood rating (one in the evening), a curated list of 42 gentle films, series, books, musicals and pieces of music with content notes, and ways to share a postcard or a daily prompt with one person through the phone's share sheet.

An experimental AI conversation, off by default and needing the person's own API key, can continue an exercise in the same approach.

## How the content was kept within self-help limits

- Only techniques reasonable to try alone are used. Empty chair, exposure, and anything that relies on a therapeutic relationship are left out, and the lenses concerned (psychoanalytic, person-centered, Gestalt, behavior therapy) say so in their "might miss" notes.
- Approaches poorly suited to grief (Adlerian, existential, Gestalt, REBT, cognitive, behavioral, reality, solution-focused, narrative) are not offered when the topic is loss.
- Wording was reviewed several times for blame and pathologizing. Examples of changes: the Adlerian summary says outright that if one's surroundings or other people are doing the hurting, that does not mean one did something wrong; the Gestalt "I choose" step says that something done to you is not your choice and accepts "I did not choose this" as an answer; bedtime tracks do not ask evaluative questions at night.
- The psychoanalytic bedtime track ("letting images drift up") gives its way out first (open your eyes, name three things in the room, feel the bed), interprets nothing, is never chosen by "Choose for me", and carries a note to pick another track on a heavy night.
- The AI conversation is limited per approach (allowed moves and moves to avoid), never diagnoses or discusses medication, does not question reports of abuse or threats, does not flatter or reassure, ends after ten turns with a summary and no question. Risk words in the person's message pause it with help lines; a risky reply without help lines is held back; the chat ends when the model gives help lines or returns an empty or refused reply. These are instructions to the model plus checks in the app, not guarantees.

## Safety design

- **Risk language.** Every free-text field that is stored or shared is checked (the lens, the ritual and the AI chat pause; a check-in note is saved first and help is shown after; the prompt exchange shows help once before sharing) for suicide, self-harm, harm to others and abuse, in Traditional Chinese and English, and tested against about 210 phrases (direct and indirect wording, and ordinary phrases that should not match, such as 累死了 or "this deadline is killing me"). A match pauses and shows help lines. Nothing written is deleted, and the person can say it meant something else and carry on. This is a coarse safety net, not a classifier, and it will miss some wording.
- **Help lines** are one tap away on every lens and ritual step and under About, shown for the person's region (guessed from the time zone, and switchable): Taiwan (1925, 1995, 113, 110, 119, and 1980 marked as not 24 hours), the US (988, the domestic violence hotline, 911), or elsewhere (the local emergency number and findahelpline.com).
- **No social comparison.** No feeds, likes, counts, streaks or leaderboards. Sharing goes to one chosen person at a time, outside the app.
- **Privacy.** Everything stays on the device unless the person shares it or turns on the AI conversation. Bedtime speech skips voices the browser reports as online, because those would send the script to a server.

## Evidence for the voice measures

A preregistered comparison with Praat on recorded English speech, a preregistered robustness study (phone codecs, volume, noise, reverberation), and a small exploratory Mandarin pilot. Pitch agrees closely with Praat; some measures (pitch range, syllable counts, voicing coverage) missed their preset thresholds and are labelled with lower confidence in the app. Details are in the README and `validation-results.md`.

## What we would most like a reviewer to check

1. Do the lens questions and bedtime scripts fit how each approach is taught, and is anything unsafe to do alone? (`content-review.md`)
2. Is the crisis wording and the help-line list right for Taiwan?
3. Should the app carry the student's name, and should the program or site supervisor know before it is shared?
4. Anything that could read as counseling, or that a person might mistake for professional care.
