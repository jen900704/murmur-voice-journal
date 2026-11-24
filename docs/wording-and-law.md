# Wording and the law

Murmur offers psychoeducation for self-reflection. It does not provide counseling, therapy, assessment or diagnosis, and its wording has to make that true in every screen. This page records the rules the app follows and why. It is a working summary, not legal advice; a short review by a lawyer in Taiwan and the US is still on the to-do list.

## Rules the app follows

- **Approaches, not therapy.** The 14 lenses are presented as counseling theories and ways of looking (取向、學派、視角). Where a theory's textbook name contains "therapy" (reality therapy, REBT), the app uses "approach" in its labels and keeps the textbook name only where it identifies the theory.
- **No service words.** The app never offers 治療、療程、諮商（as a service）、心理衡鑑、診斷、評估、篩檢、個案, or therapy, treatment, counseling session, diagnosis, assessment, screening, patient or client. These words appear only in sentences that say what the app is not.
- **No health claims.** Nothing says the app reduces anxiety or depression or improves mental health. Heaviness before and after is described as how it feels right now.
- **Voice and words compare a person with themselves.** Voice features are compared with the person's own usual range. Nothing detects or screens for a condition.
- **Who made it.** "Made by a graduate student in a clinical mental health counseling program. Not a licensed counselor or psychologist, and not a service from one."
- **The AI is labeled as AI.** The optional conversation is a reflection helper: it says it is AI, not a person and not a therapist, at the top of every conversation; it never takes a name or persona; it never diagnoses or plans treatment; risk words stop it and show help lines; and the screen says that the text goes to the provider the person chose. It is off by default and needs the person's own key.
- **Model-written text is labeled.** When a model rewords questions or writes the closing of an exercise (js/lens-llm.js), the screen says it was AI-generated and may be wrong, and the fixed version is one tap away.
- **No collection.** Murmur has no server. Any future upload (for example research donation) waits for an approved study and a consent screen; see [data-lifecycle.md](data-lifecycle.md).

## Why

**Taiwan.** The Psychologists Act (心理師法) reserves psychological assessment, counseling and therapy (心理衡鑑、心理諮商、心理治療) for licensed psychologists, protects the titles 臨床心理師 and 諮商心理師, and penalizes unlicensed practice; the student exception covers supervised internships in approved institutions, not a self-published app ([text, 2020](https://osa.ntua.edu.tw/userfiles/files/心理師法1090115.pdf)). Software used for everyday health management without a diagnostic or treatment purpose for a specific disease is generally not treated as a medical device, but classification follows the function and intended use claimed ([MOHW](https://www.mohw.gov.tw/cp-16-58006-1.html)).

**United States, federal.** FDA's General Wellness guidance (updated January 2026) covers low-risk products intended only for general wellness that make no disease or diagnostic claims ([summary](https://faegredrinker.com/en/insights/publications/2026/1/key-updates-in-fdas-2026-general-wellness-and-clinical-decision-support-software-guidance)). The FTC's Health Breach Notification Rule now reaches many health and wellness apps that hold personal health records ([summary](https://www.wsgr.com/en/insights/ftc-final-rule-officially-broadens-health-breach-notification-rule-targets-health-and-wellness-apps.html)); an app that holds no records on a server has nothing to breach, but any "nothing leaves your device" claim must stay literally true.

**United States, states.** Illinois' Wellness and Oversight for Psychological Resources Act (HB 1806, 2025) lets only licensed professionals provide or advertise therapy or psychotherapy services, with an exception for self-help and educational materials that do not purport to offer therapy ([bill text](https://www.ilga.gov/documents/legislation/104/HB/10400HB1806.htm)). Nevada AB 406 (2025) bars presenting AI as providing professional mental or behavioral health care ([summary](https://www.wsgr.com/en/insights/nevada-passes-law-limiting-ai-use-for-mental-and-behavioral-healthcare.html)). Utah HB 452 (2025) requires mental health chatbots to disclose that they are AI before use, after a week away and when asked ([summary](https://www.ebglaw.com/health-law-advisor/utah-law-aims-to-regulate-ai-mental-health-chatbots)). California and New York have added rules on AI implying a licensed professional and on self-harm protocols for companion AI ([summary](https://www.ebglaw.com/health-law-advisor/novel-ai-laws-target-companion-ai-and-mental-health)). Maryland restricts using the title or description of a licensed clinical professional counselor without a license ([§17-601](https://law.justia.com/codes/maryland/2013/article-gho/section-17-601)).

## Still to check

- Current Taiwan texts of the Medical Care Act (醫療法) advertising rules and the Personal Data Protection Act (個人資料保護法) on health data.
- Washington's My Health My Data Act, if any data is ever collected.
- A short legal review in Taiwan and Illinois, and the counseling program's own rules for student projects.
