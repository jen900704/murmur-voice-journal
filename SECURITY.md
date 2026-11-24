# Security and privacy

Murmur keeps everything on the device: recordings, journal text, lens answers and settings live in the browser's IndexedDB and localStorage. There is no server, account or analytics. The optional AI conversation sends only that conversation to the provider the person chose, with their own key.

## Reporting a problem

If you find a way that Murmur could leak data, run code from untrusted input, or fail to show help lines when it should, please open a private report through GitHub's "Report a vulnerability" button on the Security tab rather than a public issue. Include steps to reproduce and the browser and device. I aim to reply within a week.

## In scope

- Anything that sends journal, voice or lens data off the device without the person choosing it
- Script injection from imported files (social media exports, backups, zip files) or pasted text
- The service worker caching or serving something it should not
- The risk screen missing a clear risk phrase in Chinese or English (these are also welcome as normal issues, with the phrase written out only if you are comfortable)

## Not a security issue

- The risk screen matching ordinary text (a false alarm): please open a normal issue
- Content you disagree with: please use the content suggestion template
