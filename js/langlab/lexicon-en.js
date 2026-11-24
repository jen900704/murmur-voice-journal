// English category word lists for the language mirror.
// Written from scratch for Murmur (MIT, same as the app). They follow the general idea of
// counting words in psychologically meaningful categories, but no list here was copied from
// LIWC or any other dictionary, and none has been validated against human ratings.
//
// Notation: words are separated by spaces. A trailing * matches any ending ("worr*" matches
// worry, worried, worries). An underscore joins the words of a phrase ("going_to").
// One word can sit in several categories.

export const EN_VERSION = '2026.11-2';

const w = (s) => s[0].split(/\s+/).filter(Boolean);

const i = w`i i'm i'd i'll i've im ive me my mine myself`;
const we = w`we we're we'd we'll we've us our ours ourselves let's`;
const you = w`you you're you'd you'll you've your yours yourself yourselves u ur y'all ya`;

const negate = w`no not never none nothing nobody nowhere neither nor cannot can't don't doesn't didn't won't
  wouldn't shouldn't couldn't isn't aren't wasn't weren't haven't hasn't hadn't ain't mustn't needn't without
  nope nah dont cant wont didnt doesnt isnt wasnt`;

const certain = w`always never definitely certainly absolutely surely sure clearly obviously undoubtedly completely
  totally entirely every everything everyone everybody all must fact facts truly exactly indeed certain certainty
  guarantee* forever proven undeniabl* inevitabl* definite precisely necessarily unquestionabl* total
  of_course no_doubt for_sure without_a_doubt`;

const tentat = w`maybe perhaps might possibly probably possible seem seems seemed seemingly guess guessed guessing
  suppose supposed supposedly somewhat sometimes kinda sorta unsure uncertain* apparently likely unlikely could
  hopefully almost nearly roughly approximately wonder wondered wondering doubt doubts doubtful depends depending
  if or somehow something someone anyhow fairly generally usually often occasionally vague* hesita* tentative*
  may appear appears appeared assume assumed assuming estimate* mostly partly
  sort_of kind_of not_sure`;

const cause = w`because cause caused causes causing cuz since therefore thus hence consequently consequence* result
  results resulted resulting reason reasons why effect effects affect affected affects lead leads led due depend
  depends depended origin* source sources trigger* influenc* basis based purpose* root produce* react* response
  respond* outcome* thereby justif* explain* explanation*
  as_a_result due_to leads_to in_order_to`;

const insight = w`think thinks thought thoughts thinking know knows knew known knowing knowledge realize* realise*
  understand* understood consider* notice noticed notices noticing aware* believe* belief* learn* recogni* discover*
  figure figured figuring reflect* remember* recall* mean means meant meaning idea ideas insight* sense senses
  sensed decide* decision* conclude* conclusion* question questions questioned questioning analy* explain* explor*
  perspective* interpret* grasp* find found finding findings imagine* expect* suspect* reconsider* rethink*`;

const cogExtra = w`but although though however except unless whether rather instead despite otherwise versus vs yet
  should would ought need needs needed differ* compar* contrast* choice* choose chose option* problem* solve*
  solution* logic* complex*`;

const family = w`family families mom mum mother* mommy mama dad daddy father* papa parent* brother* sister* sibling*
  son sons daughter* grandma* grandpa* grandmother* grandfather* grandparent* grandchild* grandson* granddaughter*
  aunt* uncle* cousin* niece* nephew* husband* wife wives spouse* stepmom stepdad stepmother stepfather relatives
  kin twin*`;

const friend = w`friend* buddy buddies pal pals bestie* bff mate mates roommate* classmate* teammate* companion*
  boyfriend* girlfriend* partner* lover* neighbor* neighbour* colleague* coworker* acquaintance* guest* ally allies
  crew squad fiance* sweetheart*`;

const socialExtra = w`he she him her his hers he's she's they them their theirs they're they've they'd they'll people
  person persons someone somebody everyone everybody anyone anybody nobody who whom whose man men woman women guy
  guys girl girls boy boys kid kids child children baby babies adult* human* folks team* group* community
  communities crowd* public society social* talk* tell tells told telling said say says saying ask asks asked
  asking speak* spoke spoken chat* call called calling calls message* meet meets met meeting* share shared shares
  sharing listen* help helps helped helping visit* invit* hug* kiss* together conversation* discuss* argue*
  argument* gossip* party parties relationship* ex boss bosses teacher* student* client* customer* stranger* host*
  mr mrs ms sir ma'am dude bro`;

const work = w`work works worked working workplace workload job jobs career* office* boss bosses manager* employ*
  colleague* coworker* meeting* deadline* project* task* salary salaries wage* paycheck* hire hired hiring fired
  firing resign* promot* interview* resume company companies business* client* customer* report reports email*
  shift shifts overtime profession* intern interns internship* school* class classes classroom* homework exam exams
  quiz* study studies studied studying student* teacher* professor* lecture* semester* grade grades graduat* degree*
  thesis dissertation paper papers research* lab labs assignment* college* universit* campus tuition course courses
  phd advisor* supervis* team* staff labor labour retire* unemploy* presentation* schedule* duty duties commut*
  payroll`;

const body = w`body bodies head heads face faces eye eyes ear ears nose mouth lip lips tooth teeth tongue throat neck
  shoulder* arm arms hand hands finger* chest stomach belly tummy gut hip hips leg legs knee* foot feet toe toes
  skin hair bone* muscle* heart heartbeat lung* brain* blood bleed* breath breathe* breathing sweat* tears sleep*
  slept asleep awake tired exhaust* ache* aching pain pains painful headache* sore nausea* dizzy hungry hunger
  thirst* eat eats ate eaten eating drink* drank weight sick ill illness* fever cough* pulse nerve* spine wrist*
  ankle* elbow* jaw cheek* forehead waist thigh* palm* nail* shiver* trembl* numb digest*`;

const posemo = w`happy happier happiest happiness happily glad joy* enjoy* love loves loved loving lovely good great
  better best nice wonderful awesome amazing fantastic excellent beautiful fun funny laugh* lol haha* smile*
  smiling excit* grateful gratitude thank thanks thankful appreciat* proud pride hope hopes hoped hopeful hoping
  calm relax* relie* peace* comfort* cheer* delight* pleased pleasant pleasure kind kindness care cares cared
  caring warm warmth sweet cute cool win wins won winning success* lucky luck bless* brave confiden* safe safety
  satisf* perfect* brilliant fabulous terrific yay hooray celebrat* favorite* favourite* inspir* encourag*
  support* affection* adore* cherish* optimis* eager thrilled gentle hug* kiss* treasure* heal*`;

const anx = w`anxious anxiety worry worries worried worrying nervous* afraid fear* scare* scared scary terrified
  terrifying terrify panic* stress* tense tension uneasy dread* frighten* fright restless* overwhelm* insecure*
  paranoi* phobi* alarm* apprehens* jitter* shaky shaking startl* timid threat* horror horrif* distress* desperat*
  vulnerable pressure* on_edge freak_out freaked_out freaking_out`;

const anger = w`angry anger angrier mad furious fury rage* raging hate hates hated hating hatred annoy* irritat*
  frustrat* resent* bitter* hostil* aggress* outrag* pissed fuck* damn* bitch* bastard* asshole* jerk* idiot*
  stupid fight* fought argue* argument* yell* scream* shout* insult* offend* offens* rude* cruel* nasty grudge*
  revenge vengeance violent* violence attack* blame* kill killed kills destroy* punch* slap* snap snapped temper
  tantrum* livid irate enrag* infuriat* contempt* despise* loath* agitat* grumpy cranky crap screw screwed
  sick_of fed_up`;

const sad = w`sad sadder saddest sadness sadly cry cries cried crying tears tearful weep* wept sob sobbing sobbed grief
  griev* mourn* miss missed missing lonely loneliness alone depress* unhappy miserable misery heartbroken
  heartbreak* hopeless* despair* sorrow* gloom* lose loses losing loss losses lost empty emptiness disappoint*
  discourag* devastat* helpless* worthless* regret* homesick melanchol* tragic tragedy tragedies pity abandon*
  reject rejected rejection isolat* defeated defeat sigh* grim pessimis* useless let_down give_up gave_up`;

const negExtra = w`bad worse worst awful terrible horrible hurt* pain painful suffer* ugly dumb fail* guilt* shame*
  ashamed embarrass* sorry confus* disgust* gross jealous* envy envious bored boring boredom awkward mess messy
  broke broken trouble* difficult* struggle* struggling wrong weak damage* harm* unfair uncomfortabl* unpleasant
  disaster* nightmare* complain* fault* pathetic suck sucks sucked ugh shit* burnout victim* trauma* toxic
  mistake* ruin* upset`;

const focuspast = w`was were had did been wasn't weren't hadn't didn't ago yesterday earlier previously formerly past
  already went came saw said told got made took gave knew thought felt found left kept began became brought bought
  heard met ran sat stood lost paid sent spent wrote ate drank slept woke fell grew held spoke wanted needed tried
  asked looked seemed started happened worked called talked lived loved decided realized finished stopped turned
  walked stayed moved missed cried worried remembered used_to back_then last_night last_week last_month last_year`;

const focuspresent = w`am is are i'm you're we're they're he's she's it's that's there's isn't aren't now today
  tonight currently nowadays presently do does don't doesn't has have haven't hasn't being go goes come comes see
  sees say says get gets make makes take takes know knows think thinks feel feels want wants need needs try tries
  keep keeps look looks seem seems work works live lives love loves mean means happen happens start starts stay
  stays going doing feeling trying thinking working getting making looking living having coming taking waiting
  hoping wondering struggling learning right_now at_the_moment these_days this_week this_morning`;

const focusfuture = w`will won't i'll you'll we'll they'll he'll she'll it'll that'll shall gonna tomorrow soon later
  eventually someday future upcoming plan plans planning intend* expect* anticipat* ahead onward forthcoming goal
  goals going_to about_to looking_forward one_day next_week next_month next_year next_time`;


// ---- second set: relational, status, loss, motive and moral themes (same rules as above) ----
const affil = w`love loves loved loving beloved together miss missed missing belong* bond* close closer closeness
  friend* friendship* companion* hug* cuddle* dear darling sweetheart* care cares cared caring cherish* adore*
  affection* intimate intimacy dating relationship* partner* marry married marriage wedding reunion reunite* join
  joined welcome* accompany* united unity trust*`;
const conflict = w`fight* fought argue* argument* quarrel* conflict* disagree* dispute* yell* shout* scream* blame*
  accus* insult* criticiz* criticis* complain* betray* attack* enemy enemies rival* hostil* tension feud* clash*
  confront* oppos* resent* grudge* divorce* cheat* ghosted rejected breakup broke_up break_up silent_treatment`;
const lonely = w`lonely loneliness alone isolat* excluded outsider* nobody abandon* unwanted invisible forgotten ignored
  homesick solitude solitary friendless disconnected distant unloved misfit left_out no_one`;
const belong = w`belong* included accepted acceptance welcome* community communities member* membership teammate*
  connected connection* bond* tribe home hometown togetherness solidarity circle fellowship fit_in part_of`;
const grat = w`thank thanks thankful grateful gratitude appreciat* bless* blessing* fortunate lucky indebted thx ty`;
const apology = w`sorry apolog* forgive* forgave pardon regret* oops excuse_me my_bad my_fault`;
const compare = w`compar* envy envious jealous* inferior superior outperform* rank* smarter prettier richer thinner
  taller better_than worse_than than_me than_her than_him than_them compared_to keep_up catching_up everyone_else
  good_enough measure_up as_good_as`;
const request = w`please must should ought gotta hurry need_to have_to has_to had_to got_to can_you could_you would_you
  will_you you_should you_must you_need make_sure remember_to don't_forget let_me let's`;
const polite = w`please thank thanks sorry pardon sir ma'am madam kindly appreciate* grateful regards sincerely cheers
  apolog* excuse_me would_you could_you may_i`;
const loss = w`loss losses lost lose losing death dead die died dies dying funeral* grave* grief griev* mourn* bereave*
  widow* farewell goodbye* gone memorial* burial buried cemetery condolence* departed deceased cremat* obituar*
  coffin casket ashes orphan* miscarriage hospice passed_away pass_away`;
const achieve = w`achiev* accomplish* succeed* success* win wins won winning goal goals earn* master* mastery improve*
  improvement* progress* effort* strive* striving ambition* ambitious compet* excel* award* prize* promot* finish*
  complete* graduat* fail* failure* perform* performance productive productivity skill* champion* victory triumph*
  overcome overcame work_hard hard_work`;
const reward = w`reward* prize* bonus* gift* treat treats earn* win wins won gain* benefit* profit* paid payoff enjoy*
  fun pleasure pleasant delicious yummy celebrat* deserve* luck lucky jackpot perk* worth_it`;
const risk = w`risk* danger* caution* cautious careful* safe safety unsafe threat* hazard* warn* warning* avoid* prevent*
  protect* protection secure security insecure gamble* beware alert emergenc* crisis crises precaution* reckless
  vulnerable defensive wary hesitant`;
const care = w`care cares cared caring kind kindness compassion* empath* sympath* help helps helped helping protect*
  nurtur* gentle comfort* support* heal* hurt* harm* suffer* cruel* neglect* tender mercy merciful generous
  generosity charity`;
const fair = w`fair fairness unfair unfairness equal* inequal* justice injustice unjust rights deserve* bias* biased
  discriminat* prejudice* impartial cheat* trust* trustworthy fraud* reciproc* balanced integrity`;
const loyal = w`loyal* betray* traitor* faithful unfaithful devot* allegiance ally allies united unity solidarity team*
  nation* patriot* comrade* commitment committed commit promise* stand_by stick_together`;
const authority = w`authority authorities obey* obedien* disobey* respect* disrespect* rule rules law laws order orders
  duty duties tradition* boss leader* leadership elder elders hierarchy rank permission permit* allowed forbid*
  forbidden command* discipline* comply complian* rebel* defy* defian* honor honour submit*`;
const sanct = w`pure purity sacred holy clean cleanse* dirty filth* disgust* gross sin sins sinful saint* pious faith
  pray* prayer* god gods divine spirit* spiritual soul temple church blessed bless* worship* taint* contaminat*
  impure innocent innocence modest* decent decency wholesome sacrifice*`;
const excl = w`but except without although though however unless whereas rather instead yet excluding exclude* besides
  nevertheless nonetheless otherwise other_than apart_from aside_from`;
const other = w`he she him her his hers himself herself they them their theirs themselves he's she's they're they've
  they'd they'll he'd she'd he'll she'll`;

const uniq = (...lists) => [...new Set(lists.flat())];

// group: where the row is shown; kind 'function' or 'content' sets the minimum word count
export const EN_CATEGORIES = {
  i: { words: i },
  we: { words: we },
  you: { words: you },
  negate: { words: negate },
  certain: { words: certain },
  tentat: { words: tentat },
  cogproc: { words: uniq(cause, insight, certain, tentat, cogExtra) },
  cause: { words: cause },
  insight: { words: insight },
  social: { words: uniq(you, we, family, friend, socialExtra) },
  family: { words: family },
  friend: { words: friend },
  work: { words: work },
  body: { words: body },
  posemo: { words: posemo },
  negemo: { words: uniq(anx, anger, sad, negExtra) },
  anx: { words: anx },
  anger: { words: anger },
  sad: { words: sad },
  focuspast: { words: focuspast },
  focuspresent: { words: focuspresent },
  focusfuture: { words: focusfuture },
  other: { words: other },
  excl: { words: excl },
  affil: { words: affil },
  conflict: { words: conflict },
  lonely: { words: lonely },
  belong: { words: belong },
  grat: { words: grat },
  apology: { words: apology },
  compare: { words: compare },
  request: { words: request },
  polite: { words: polite },
  loss: { words: loss },
  achieve: { words: achieve },
  reward: { words: reward },
  risk: { words: risk },
  care: { words: care },
  fair: { words: fair },
  loyal: { words: loyal },
  authority: { words: authority },
  sanct: { words: sanct },
};

// Function-word classes used only by the analytic-thinking index (English only).
const theyish = other;
export const EN_FUNCTION_CLASSES = {
  article: w`a an the`,
  prep: w`about above across after against along among around at before behind below beneath beside between beyond
    by despite down during except for from in inside into near of off on onto out outside over past since through
    throughout to toward towards under until unto up upon with within without via per than`,
  ppron: uniq(i, we, you, theyish),
  ipron: w`it its it's itself this that these those that's what what's which who whom whose whatever whoever
    something anything everything nothing someone anyone everyone somebody anybody everybody nobody other others
    another thing things stuff it'll it'd`,
  auxverb: w`am is are was were be been being have has had having do does did will would shall should can could may
    might must ought i'm you're we're they're he's she's it's that's i've you've we've they've i'll you'll we'll
    they'll he'll she'll it'll i'd you'd we'd they'd he'd she'd don't doesn't didn't isn't aren't wasn't weren't
    haven't hasn't hadn't won't wouldn't shouldn't can't cannot couldn't mustn't ain't gonna`,
  conj: w`and but or nor so yet because although though while whereas if unless when whenever whether as once plus
    however`,
  adverb: w`very really just so too also only even still again already always never often sometimes usually maybe
    perhaps probably actually basically literally totally completely quite rather pretty almost nearly here there
    now then soon later ever yet well back away instead anyway especially simply finally suddenly definitely
    absolutely certainly honestly seriously hopefully how when where why`,
  negate,
};
// index = 30 + article + prep - ppron - ipron - auxverb - conj - adverb - negate (each in percent of words)
export const ANALYTIC_WEIGHTS = { article: 1, prep: 1, ppron: -1, ipron: -1, auxverb: -1, conj: -1, adverb: -1, negate: -1 };
export const ANALYTIC_CONSTANT = 30;
