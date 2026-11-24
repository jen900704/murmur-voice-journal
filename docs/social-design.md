# Connecting with other people: design notes

Murmur currently has no server, and everything stays on the device (the one exception is the optional AI conversation, which sends that conversation to Anthropic with the person's own API key). People can already share what they choose through their phone's own share sheet:

- a bedtime postcard image;
- a goodnight card to one person, carrying only a fixed line they pick (never what they wrote that night);
- an answer to the daily prompt, with a link that opens the same prompt for the other person.

That covers sharing with people someone already knows, without Murmur storing anything, and with no counts, feeds, or read receipts.

Anything where one user's words reach another user inside the app needs a server, accounts, and someone responsible for moderation. This note sets out what that would take before any of it is built.

## Why not tonight

- It breaks the app's central promise that nothing leaves the device. That promise would have to be rewritten in plain words, and the social part kept strictly separate from the voice journal.
- People will post during their worst moments. Every post is a possible crisis message, and someone has to be able to respond.
- A feed of other people's good days is exactly where social comparison and performance start.

## Order to build in, if at all

1. **Pairs by invite code.** Two people who already know each other (partners, close friends) exchange prompt answers and postcards. No discovery, no strangers. This covers most of the wish to connect at the lowest risk.
2. **Small closed groups** (for example a class or a support group with a facilitator), invite only, with a named facilitator.
3. **A public commons** only if 1 and 2 work and there is staff for review.

## Minimum safe design for any shared space

- Opt in, separate from the journal. Journal data never syncs.
- 18 or older, with terms that say what the space is and is not.
- Short text only: no images, links, usernames, profiles, follower lists, replies under posts, or direct messages from strangers.
- No likes, counts, streaks, rankings, or "most popular". Posts shown in random order, with a small daily cap per person.
- Every post runs through the same risk check as the app before it is submitted. A match shows help lines and is not posted.
- Pre-moderation: nothing is visible until a person has reviewed it. Report and block on every item; reported items hide immediately.
- A named moderator and a stated response time. If nobody can staff review, the space does not launch.

## "One kind thing I did for myself" with other people

The private kindness jar already brings someone's own past kind acts back on low days, which avoids comparison entirely. The low-day card also offers up to three small general actions from a list of 14 (a warm drink, two minutes at a window, a sticker to someone), written by Murmur rather than posted by users, so there is no one to compare with. If shared kind acts are ever added, they should appear as anonymous, small, ordinary ideas ("someone went to bed early"), matched to the reader's energy level, never as posts by named people, and never with counts.

## Platform options

Supabase or Firebase would both work for invite-code pairs with row-level security. Either needs the owner's own account and a privacy policy. A decision on this belongs to the owner.

## Questions for the owner before step 1

1. Who is the first audience: partners, close friends, or a class or group you run?
2. Are you willing to be named as the person responsible for the shared space, and how quickly could you respond to a report?
3. Is it acceptable that pairs would need a small server (and that the "nothing leaves the device" promise becomes "nothing leaves the device except what you send to your pair")?
4. Should a supervisor or the program know before it launches, given that the app carries a counseling student's name?
