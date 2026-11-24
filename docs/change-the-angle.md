# Change the angle (換角度): design notes

換角度 is the center of Murmur. A person writes down one worry and looks at it through one of 14 counseling approaches, one short set of questions at a time. Everything else in the app (voice journal, language mirror, bedtime ritual) supports it.

This page explains what each part does, why it is there, what is measured, and what it cannot claim. It is psychoeducation for self-reflection, not counseling.

## The flow

1. **Name the worry.** One or two sentences, and one or more kinds of worry (work or school, relationships, family, self, loss, other). Optionally, how heavy it feels right now, 0 to 10.
2. **Choose an angle.** Three ways: a compact list that puts the approaches often used for that kind of worry first, a random draw, or three side by side. When the person's own words carry a cue for an approach (for example 應該 / should, 一直想 / can't stop thinking, 從小 / since I was a kid), the angle is suggested with the exact words that matched. When nothing matches, nothing is suggested.
3. **Three questions in that approach's style.** "Not sure" is a fine answer and is never quoted back.
4. **Optional change of distance.** What would you tell a good friend in this spot, or how might this look a year from now. Not offered by default for loss.
5. **Summary.** Each question with the person's answer verbatim, the approach's perspective in a few plain sentences, something small to try, key ideas, and what this approach can miss. No sentences are built around the person's answers.
6. **How heavy now.** The same 0 to 10 question again. The change is shown as it is ("7 → 5"); heavier or unchanged is described as common, never as failure.
7. **A card to keep.** A small picture drawn from what the person wrote, with a short animation.
8. **A small plan.** Optionally, when to try the small thing ("before the next meeting"). The next visit, at least half a day later, asks once: tried it, not yet, or not for me.
9. **Same worry, another angle.** Earlier looks at a similar worry are listed, and what this angle brought up that the earlier one did not.

## Why each part is there

| Part | Idea it borrows | Source |
|---|---|---|
| Several approaches on one worry | Flexibility: fitting the way of coping to the situation, rather than one fixed strategy | Bonanno & Burton (2013), *Perspectives on Psychological Science*; Kashdan & Rottenberg (2010), *Clinical Psychology Review* |
| Before and after heaviness | Belief and distress ratings before and after a thought record | Standard in cognitive therapy (Beck, 2011, *Cognitive Behavior Therapy: Basics and Beyond*) |
| Changing distance | Self-distancing and third-person self-talk reduce distress and support wiser reasoning; temporal distancing ("this too shall pass") lowers distress | Kross & Ayduk (2017), *Advances in Experimental Social Psychology*; Grossmann & Kross (2014), *Psychological Science*; Moser et al. (2017), *Scientific Reports*; Bruehlman-Senecal & Ayduk (2015), *JPSP* |
| Writing it out in one's own words | Expressive writing | Pennebaker & Beall (1986); Frattaroli (2006) meta-analysis |
| One short, complete session | Single-session interventions | Schleider & Weisz (2017), *JAACAP* |
| A small plan ("I'll try it when ...") | Implementation intentions | Gollwitzer & Sheeran (2006), *Advances in Experimental Social Psychology* |
| The 14 approaches and their questions | Each approach's core questions | Corey, *Theory and Practice of Counseling and Psychotherapy* |

## The card picture

`js/scene.js` reads a scene from the person's own words:

- **Setting** from the kind of worry (a desk by a window for work, a bench for relationships, a roof for family, a path for self, a candle for loss).
- **Weather** from how heavy the words are (rain, clouds, sun behind clouds, sun). When the person says it feels lighter afterwards, the sky opens a little.
- **Up to three objects** they actually mentioned, in the order they wrote them (an exam becomes a book, 主管 a laptop, tea a cup, the sea waves), and a small companion. A cat or dog they mention becomes the companion.
- **A small glyph** for the approach (a book for narrative, a leaf for acceptance, an empty chair for Gestalt).

Every element keeps the word it came from, and the card can say so: "the rain is from 好累". Only an allowlist of everyday objects can be drawn. If the text trips the risk screen, nothing is read from it and the card is a quiet night scene. The animation (clouds drift aside, the companion hops, a few sparkles) is wrapped in `prefers-reduced-motion`, and saved images are still.

## Explainable suggestions

`js/lens-insight.js` holds hand-written cue lists per approach, in Chinese and English, drawn from what each approach listens for. A suggestion is always shown with the matched words in context. Cues are hints, not a classifier: they will miss indirect wording and can match ordinary text. They never override the topic rules (for example, only grief-suited approaches for loss) and never touch the optional bandit, which keeps its own logged propensities.

## When a language model helps

Fixed questions read the same for everyone. When a model is available, `js/lens-llm.js` lets the exercise follow the person:

- **Questions reworded for this worry**, same intent and order as the approach's own questions.
- **One optional follow-up** after an answer, picking up an exact phrase the person wrote.
- **A closing written for this situation**: how the approach would look at it (explained only from Murmur's reviewed passages, with passage ids), one small thing to try, and the card's picture and line.

Where it runs: the browser's on-device model when one exists for the language (nothing leaves the device), otherwise the person's own API key if they turned the AI option on (the text of this one exercise is sent, and the screen says so first, with a switch back to the fixed version), otherwise nowhere: the fixed content is used.

What keeps it safe: no call at all when the risk screen matches; the person's text is fenced as data and cannot act as instructions; every reply is parsed and checked field by field (length, a question mark where a question is expected, no praise, no diagnosis words, no em dashes, the risk screen again, every quoted phrase must be an exact piece of what the person wrote, pictures only from the allowlist and each tied to a word they wrote); a field that fails is replaced by the fixed text, not shown. Replies are cached so reopening shows the same words. Tests with a mocked model cover each check (`tests/llm.test.mjs`).

## What is measured

All on the device, nothing sent anywhere.

- Heaviness before and after, per session and per approach.
- The 1 to 5 helpfulness rating (also the optional bandit's reward).
- What one approach's answers contain that another approach's answers on the same worry do not (character-bigram overlap).
- Share of first-person words before and after the distancing step, shown only as an observation.

With one person's data these are descriptions, not evidence that anything works. No percentages or trends are shown for very few sessions.

## Limits

- This is not therapy and does not replace a counselor. Only techniques reasonable to try alone are included.
- A worry can feel heavier after looking at it closely; that is common and the app says so.
- The risk screen is a coarse net. Help lines are one tap away on every step.
