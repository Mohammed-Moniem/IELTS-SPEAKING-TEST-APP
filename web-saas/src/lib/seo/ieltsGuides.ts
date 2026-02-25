export type IeltsGuide = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intent: 'informational' | 'commercial' | 'transactional';
  overview: string;
  keyPoints: string[];
  actionPlan: string[];
  recommendedPlan: 'Free' | 'Premium' | 'Pro' | 'Team';
  authorName: string;
  reviewerName: string;
  lastReviewed: string;
};

const defaultAuthor = 'Spokio IELTS Content Team';
const defaultReviewer = 'Spokio Academic Review Board';
const reviewedAt = '2026-02-22';

export const ieltsGuides: IeltsGuide[] = [
  {
    slug: 'ielts-speaking-practice-online',
    title: 'IELTS Speaking Practice Online',
    description:
      'Practice IELTS Speaking Parts 1, 2, and 3 with realistic prompts, recording workflows, and evaluator-style feedback.',
    h1: 'IELTS Speaking Practice Online: Build Part 1-3 Confidence',
    intent: 'commercial',
    overview:
      'Strong speaking scores come from realistic timing, topic exposure, and feedback loops. Train with full part progression and review your weaknesses after each run.',
    keyPoints: [
      'Practice all three speaking parts with strict timing and transition flow.',
      'Record answers and review transcripts to fix fluency and coherence gaps.',
      'Repeat weak topic areas until follow-up questions feel natural.'
    ],
    actionPlan: [
      'Run two short Part 1 sessions daily on mixed personal-topic prompts.',
      'Complete one timed Part 2 cue-card response and review pacing.',
      'Close each week with one full speaking simulation and compare scores.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-speaking-part-2-cue-card-strategy',
    title: 'IELTS Speaking Part 2 Cue Card Strategy',
    description:
      'Master IELTS Speaking Part 2 cue cards with planning templates, structure timing, and fluency-focused delivery methods.',
    h1: 'IELTS Speaking Part 2: Cue Card Strategy That Scales',
    intent: 'informational',
    overview:
      'Part 2 rewards coherent storytelling under pressure. Use a simple idea map and a clear 3-part structure to avoid pauses and repetition.',
    keyPoints: [
      'Spend the one-minute planning phase on keywords only, not full sentences.',
      'Use opening, detail development, and reflection to keep your response stable.',
      'Anchor examples to personal experiences to improve fluency and lexical range.'
    ],
    actionPlan: [
      'Practice one cue card daily and record your two-minute answer.',
      'Review filler words and long pauses directly from transcript playback.',
      'Rotate topic categories weekly to improve response flexibility.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-speaking-part-3-follow-up-questions',
    title: 'IELTS Speaking Part 3 Follow-Up Questions',
    description:
      'Handle IELTS Speaking Part 3 follow-up questions with idea expansion methods and advanced answer framing.',
    h1: 'IELTS Speaking Part 3: Answer Follow-Up Questions Clearly',
    intent: 'informational',
    overview:
      'Part 3 evaluates your ability to discuss abstract ideas with control. Strong answers use claims, reasons, and examples rather than short opinions.',
    keyPoints: [
      'Start with a direct position and expand with one reason.',
      'Use compare-and-contrast framing for society-level questions.',
      'Avoid over-complex grammar that slows delivery and clarity.'
    ],
    actionPlan: [
      'Complete two Part 3 question sets every day with 60-second answers.',
      'Mark unclear logic points and rewrite those answers in bullet form.',
      'Run one full speaking simulation every week to test transfer.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-writing-task-2-guide',
    title: 'IELTS Writing Task 2 Guide',
    description:
      'Learn how to structure IELTS Writing Task 2 essays with clear argument flow, cohesive paragraphs, and band-focused scoring criteria.',
    h1: 'IELTS Writing Task 2: Structure, Cohesion, and Band Focus',
    intent: 'informational',
    overview:
      'Task 2 rewards relevance, clear position, logical development, and language control. A repeatable essay structure reduces time pressure and improves consistency.',
    keyPoints: [
      'Use introduction, two body paragraphs, and a direct conclusion for most prompts.',
      'Answer every part of the question and maintain one clear stance.',
      'Prioritize coherence and lexical precision over complex but unstable grammar.'
    ],
    actionPlan: [
      'Draft one 40-minute essay each day with strict timer discipline.',
      'Review rubric feedback and rewrite one weak paragraph immediately.',
      'Track recurring errors in grammar, cohesion devices, and task response.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-writing-task-2-opinion-essay',
    title: 'IELTS Writing Task 2 Opinion Essay',
    description:
      'Write stronger IELTS opinion essays with clear thesis control, paragraph logic, and argument-support examples.',
    h1: 'IELTS Opinion Essays: Clear Position, Strong Support',
    intent: 'informational',
    overview:
      'Opinion essays require a consistent stance from introduction to conclusion. The most common score loss comes from mixed or weakly supported positions.',
    keyPoints: [
      'State your opinion directly in the introduction and keep it consistent.',
      'Use one core idea per body paragraph with relevant examples.',
      'Close with a conclusion that reinforces your position, not new ideas.'
    ],
    actionPlan: [
      'Train with five opinion prompts per week under 40-minute limits.',
      'Highlight claim and evidence sentences during self-review.',
      'Use feedback to reduce repetition and vague generalizations.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-writing-task-1-academic',
    title: 'IELTS Writing Task 1 Academic',
    description:
      'Prepare for IELTS Academic Writing Task 1 with chart, table, and process response strategies and overview-first reporting.',
    h1: 'IELTS Academic Writing Task 1: Report Visual Data Clearly',
    intent: 'informational',
    overview:
      'Task 1 is about accurate trend reporting, not opinions. High scores depend on selecting key features, giving an overview, and supporting with grouped data.',
    keyPoints: [
      'Write a clear overview sentence before detailed comparisons.',
      'Group related values instead of describing every data point separately.',
      'Use precise language for trends, peaks, stability, and contrast.'
    ],
    actionPlan: [
      'Practice one visual type daily: line, bar, table, map, and process.',
      'Limit yourself to 20 minutes and keep output between 150-190 words.',
      'Review whether your overview highlights the biggest movements only.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-writing-task-1-general-letter',
    title: 'IELTS Writing Task 1 General Letter',
    description:
      'Improve IELTS General Writing Task 1 letters with tone control, purpose clarity, and formal-semi-formal structure.',
    h1: 'IELTS General Letter Writing: Tone and Task Success',
    intent: 'informational',
    overview:
      'General Task 1 scores depend on fulfilling every bullet point with suitable tone. Candidates often lose marks by missing one requested action.',
    keyPoints: [
      'Match tone to recipient: formal, semi-formal, or informal.',
      'Address every bullet prompt clearly in the letter body.',
      'Use concise paragraphing to keep communication direct and effective.'
    ],
    actionPlan: [
      'Write three letters each week with mixed tone requirements.',
      'Check your draft for full bullet-point coverage before submission.',
      'Create a phrase bank for polite requests, apologies, and invitations.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-reading-question-types',
    title: 'IELTS Reading Question Types',
    description:
      'Master IELTS Reading question types with targeted scanning strategies, time allocation, and error reduction techniques.',
    h1: 'IELTS Reading Question Types: Strategy by Format',
    intent: 'informational',
    overview:
      'Reading scores improve when strategy matches question type. Build separate routines for headings, T/F/NG, matching, and completion tasks.',
    keyPoints: [
      'Use skimming for structure first, then scan for detail-based answers.',
      'Treat True/False/Not Given as evidence tasks, not intuition tasks.',
      'Control time by moving on quickly from low-confidence questions.'
    ],
    actionPlan: [
      'Train two question types per session with strict 20-minute blocks.',
      'Mark error causes: misread keyword, wrong paragraph, or assumption.',
      'Finish each week with one full timed reading mock.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-reading-true-false-not-given',
    title: 'IELTS Reading True False Not Given',
    description:
      'Avoid common IELTS T/F/NG mistakes with sentence-matching methods and evidence-first elimination strategy.',
    h1: 'IELTS True False Not Given: Evidence-First Method',
    intent: 'informational',
    overview:
      'T/F/NG questions test precision. The right approach is evidence extraction from exact lines, not relying on topic-level understanding.',
    keyPoints: [
      'Find the exact sentence range before choosing an answer.',
      'Use keyword synonyms to locate paraphrased evidence quickly.',
      'Mark Not Given only when no direct support or contradiction exists.'
    ],
    actionPlan: [
      'Practice one passage of T/F/NG daily with timed review.',
      'Keep an error log separating False and Not Given confusion points.',
      'Reattempt the same set after corrections to reinforce patterns.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-reading-matching-headings',
    title: 'IELTS Reading Matching Headings',
    description:
      'Solve IELTS matching headings questions faster using paragraph gist extraction and distractor filtering.',
    h1: 'IELTS Matching Headings: Fast Gist Extraction',
    intent: 'informational',
    overview:
      'Matching headings rewards understanding paragraph purpose rather than isolated facts. You need top-down comprehension before selecting options.',
    keyPoints: [
      'Read first and last lines to capture paragraph direction quickly.',
      'Write a one-line gist before checking heading choices.',
      'Eliminate headings that mention details not central to the paragraph.'
    ],
    actionPlan: [
      'Complete one headings set every other day under strict timing.',
      'Compare your gist sentence with official answer reasoning.',
      'Practice passage-to-heading mapping without options first.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-listening-band-score',
    title: 'IELTS Listening Band Score Improvement',
    description:
      'Improve IELTS Listening band score through section-based drills, distractor awareness, and answer-transfer accuracy.',
    h1: 'IELTS Listening Band Score: Practical Improvement Method',
    intent: 'informational',
    overview:
      'Listening gains come from pattern recognition and disciplined note focus. You need section-by-section drills and frequent error analysis to reduce repeated misses.',
    keyPoints: [
      'Preview questions before audio starts and predict likely answer forms.',
      'Watch for distractors: corrected numbers, changed plans, and contrast words.',
      'Protect points by checking spelling and plural endings during transfer.'
    ],
    actionPlan: [
      'Complete one full listening section drill daily with corrections.',
      'Record every error and categorize it as vocabulary, speed, or distractor.',
      'Run two full listening mocks per week under exam timing.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-listening-map-labelling-strategy',
    title: 'IELTS Listening Map Labelling Strategy',
    description:
      'Improve IELTS map labelling accuracy with directional language drills and pre-audio landmark mapping.',
    h1: 'IELTS Listening Map Labelling: Directional Accuracy',
    intent: 'informational',
    overview:
      'Map questions can drop scores quickly when direction words are missed. A reliable pre-audio orientation method improves answer speed and confidence.',
    keyPoints: [
      'Identify the starting point and compass orientation before audio begins.',
      'Underline direction terms like opposite, adjacent, and beyond.',
      'Track route progression rather than trying to visualize entire maps at once.'
    ],
    actionPlan: [
      'Practice map sections three times weekly with transcript review.',
      'Build a directional phrase list and test recall daily.',
      'Repeat missed map questions after 24 hours to reinforce patterns.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-listening-multiple-choice-tips',
    title: 'IELTS Listening Multiple Choice Tips',
    description:
      'Answer IELTS listening multiple-choice questions accurately by anticipating distractors and capturing key contrast cues.',
    h1: 'IELTS Listening Multiple Choice: Reduce Distractor Traps',
    intent: 'informational',
    overview:
      'Multiple-choice sections frequently include deliberate distractors. You need selective listening for decision points rather than broad note-taking.',
    keyPoints: [
      'Read options early and predict likely contrast words.',
      'Track when speakers revise, reject, or clarify statements.',
      'Avoid selecting the first matching phrase without full context.'
    ],
    actionPlan: [
      'Do one multiple-choice set daily with immediate review.',
      'Mark where the audio shifted the final correct answer.',
      'Train with speed-up playback for concentration resilience.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-full-mock-test-online',
    title: 'IELTS Full Mock Test Online',
    description:
      'Take complete IELTS mock tests online with section orchestration, realistic timing, and consolidated readiness analytics.',
    h1: 'IELTS Full Mock Test Online: Simulate Real Exam Conditions',
    intent: 'transactional',
    overview:
      'Full mocks reveal stamina and transition issues that module-only practice can miss. Use complete runs to measure readiness and section-level consistency.',
    keyPoints: [
      'Run speaking, writing, reading, and listening in the same cycle.',
      'Use one consolidated result dashboard to identify weakest module.',
      'Track improvement by comparing full-test outcomes week over week.'
    ],
    actionPlan: [
      'Schedule at least one full mock every weekend without interruptions.',
      'Review section timing drift and concentration drops between modules.',
      'Prioritize practice for the lowest-scoring module before the next mock.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-academic-vs-general',
    title: 'IELTS Academic vs General Training',
    description:
      'Understand the differences between IELTS Academic and General Training modules, task formats, and preparation focus.',
    h1: 'IELTS Academic vs General: Choose the Right Track',
    intent: 'informational',
    overview:
      'Your target exam depends on migration, work, or education requirements. Choosing the wrong track can waste preparation time and reduce score relevance.',
    keyPoints: [
      'Speaking and listening formats are shared between both tracks.',
      'Reading and writing tasks differ in source material and task style.',
      'Confirm the required module with your university or immigration body.'
    ],
    actionPlan: [
      'Validate destination requirements before starting a study plan.',
      'Practice with track-specific writing prompts from day one.',
      'Use full mocks in your exact target track to avoid format surprises.'
    ],
    recommendedPlan: 'Free',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-study-plan-30-days',
    title: '30 Day IELTS Study Plan',
    description:
      'Use a 30 day IELTS study plan with balanced speaking, writing, reading, and listening blocks and measurable weekly checkpoints.',
    h1: '30 Day IELTS Study Plan: Daily Routine for Score Growth',
    intent: 'commercial',
    overview:
      'A short exam window needs strict weekly milestones and focused revision loops. Balanced module coverage prevents score bottlenecks in any single section.',
    keyPoints: [
      'Use fixed daily blocks for one productive task per module.',
      'Review feedback the same day to prevent repeated mistakes.',
      'Run weekly progress checks and adjust effort toward weak modules.'
    ],
    actionPlan: [
      'Week 1: baseline diagnostics and track selection.',
      'Week 2-3: focused drills, timed practice, and rubric-based revision.',
      'Week 4: two full mocks, gap closure, and final confidence run.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-band-7-in-60-days',
    title: 'IELTS Band 7 in 60 Days',
    description:
      'Plan a realistic 60-day IELTS prep cycle for Band 7 with weekly targets, mock frequency, and module-level diagnostics.',
    h1: 'How to Reach IELTS Band 7 in 60 Days',
    intent: 'commercial',
    overview:
      'A two-month preparation plan works when each week has clear output targets and frequent mock checkpoints. Consistency matters more than long but irregular sessions.',
    keyPoints: [
      'Set weekly module targets with measurable practice outcomes.',
      'Use full mocks every 10-14 days to validate readiness progress.',
      'Address one top weakness per week to avoid diluted effort.'
    ],
    actionPlan: [
      'Weeks 1-2: baseline diagnostics and core technique stabilization.',
      'Weeks 3-6: high-volume timed practice with error-led revision.',
      'Weeks 7-8: intensive mocks and final polish on weak modules.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-vocabulary-for-band-8',
    title: 'IELTS Vocabulary for Band 8',
    description:
      'Build IELTS Band 8 vocabulary through topic clusters, collocation training, and context-first usage practice.',
    h1: 'IELTS Vocabulary for Band 8: Precision Over Complexity',
    intent: 'informational',
    overview:
      'Band 8 vocabulary is about accurate, natural usage rather than memorizing rare words. Collocation control and topic relevance are the highest-value skills.',
    keyPoints: [
      'Use topic-based word families instead of random word lists.',
      'Train collocations and sentence-level usage, not isolated terms.',
      'Recycle vocabulary across speaking and writing responses weekly.'
    ],
    actionPlan: [
      'Create one topic vocabulary set each week with collocations.',
      'Use new terms in speaking recordings and writing drafts immediately.',
      'Drop words that feel forced or reduce clarity under time pressure.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-grammar-mistakes-to-avoid',
    title: 'IELTS Grammar Mistakes to Avoid',
    description:
      'Fix common IELTS grammar mistakes that reduce band score, including agreement errors, tense drift, and sentence fragments.',
    h1: 'IELTS Grammar Mistakes to Avoid Before Test Day',
    intent: 'informational',
    overview:
      'Grammar errors lower score reliability in writing and speaking. The fastest improvement comes from targeting repeated error categories instead of broad grammar study.',
    keyPoints: [
      'Track and fix repeated subject-verb agreement mistakes.',
      'Keep tense usage consistent within each idea sequence.',
      'Avoid run-on sentences and fragments in timed writing tasks.'
    ],
    actionPlan: [
      'Log grammar errors after every writing or speaking session.',
      'Run focused drills on one grammar issue each day.',
      'Recheck grammar hotspots in final 3 minutes before submission.'
    ],
    recommendedPlan: 'Premium',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  },
  {
    slug: 'ielts-time-management-strategy',
    title: 'IELTS Time Management Strategy',
    description:
      'Use a practical IELTS time management strategy for every module with checkpoint timing and recovery tactics.',
    h1: 'IELTS Time Management: Module-by-Module Control',
    intent: 'informational',
    overview:
      'Many band losses come from time mismanagement, not skill gaps. You need strict timing checkpoints and simple recovery rules for each module.',
    keyPoints: [
      'Set hard time checkpoints before each module begins.',
      'Move on from stalled questions using confidence-based triage.',
      'Reserve final minutes for verification in writing and listening.'
    ],
    actionPlan: [
      'Practice every module with a visible timer and checkpoints.',
      'Use timed mini-drills to build speed without quality loss.',
      'Rehearse recovery plans for when you fall behind schedule.'
    ],
    recommendedPlan: 'Pro',
    authorName: defaultAuthor,
    reviewerName: defaultReviewer,
    lastReviewed: reviewedAt
  }
];

export function getIeltsGuideBySlug(slug: string): IeltsGuide | undefined {
  return ieltsGuides.find(guide => guide.slug === slug);
}

