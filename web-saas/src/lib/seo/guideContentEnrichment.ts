import { normalizeIeltsPath } from '@/lib/seo/guideRoutes';
import type {
  GuideDetailResponse,
  GuideModule,
  GuidePageDetail,
  GuidePageSummary,
  GuideTreeNode,
  GuideTreeResponse
} from '@/lib/types';

type ModuleProfile = {
  label: string;
  examFacts: string[];
  keyMethod: string[];
  commonMistakes: string[];
  timedDrill: string;
};

type TopicOverride = {
  pattern: RegExp;
  directAnswer: string;
  method: string[];
  mistakes: string[];
  drill: string;
  takeaways: string[];
  checklist: string[];
  geoQuestions: string[];
  faqItems: Array<{ question: string; answer: string }>;
};

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /practice-first .* guide for/i,
  /structured drills, mistakes to avoid/i,
  /practical steps and drill structure/i,
  /this route maps ielts strategy/i,
  /spokio .* route for/i,
  /source-attributed reference/i,
  /where is the source reference for this guide/i,
  /move to the next linked route/i,
  /25-minute drill: 5 minutes plan, 15 minutes execute, 5 minutes score/i
];

const SHARED_SOURCE_URLS = [
  'https://www.ielts.org/take-a-test/test-types',
  'https://www.ielts.org/take-a-test/preparation-resources',
  'https://www.ielts.org/take-a-test/your-results/ielts-scoring-in-detail',
  'https://www.cambridgeenglish.org/exams-and-tests/ielts/'
];

const MODULE_PROFILES: Record<GuideModule, ModuleProfile> = {
  speaking: {
    label: 'Speaking',
    examFacts: [
      'IELTS Speaking is a live interview format and typically runs for 11-14 minutes across Part 1, Part 2, and Part 3.',
      'Speaking scores are judged across fluency and coherence, lexical resource, grammatical range and accuracy, and pronunciation.',
      'Higher bands require clear development, not just longer answers.'
    ],
    keyMethod: [
      'Answer directly in the first sentence, then extend with one clear reason and one specific example.',
      'Use short planning notes before long turns so your structure stays stable under time pressure.',
      'Review recordings for pauses, repetition, and unclear pronunciation before your next attempt.'
    ],
    commonMistakes: [
      'Giving short, one-line answers in Part 1 and losing fluency evidence.',
      'Memorizing scripted Part 2 stories that break under follow-up questions.',
      'Using advanced words incorrectly instead of accurate, natural vocabulary.'
    ],
    timedDrill:
      'Run one full speaking cycle (Part 1: 4 minutes, Part 2: 1 minute prep + 2 minute talk, Part 3: 4-5 minutes), then review transcript and mark 3 upgrades.',
  },
  writing: {
    label: 'Writing',
    examFacts: [
      'IELTS Writing is 60 minutes total; Task 2 carries more weight than Task 1 in overall writing scoring.',
      'Task 1 minimum is 150 words and Task 2 minimum is 250 words.',
      'Band improvement comes from task response + coherence first, then language accuracy.'
    ],
    keyMethod: [
      'Plan paragraph purpose before writing so each paragraph has one clear job.',
      'Write with explicit linking logic: claim -> explanation -> example.',
      'Reserve final minutes to check verb forms, articles, and sentence control.'
    ],
    commonMistakes: [
      'Writing off-topic because prompt keywords were not mapped before drafting.',
      'Using memorized introductions that do not match the question type.',
      'Ignoring paragraph-level coherence and relying only on vocabulary complexity.'
    ],
    timedDrill:
      'Complete a 40-minute Task 2 essay, then spend 10 minutes scoring against task response and coherence, and 10 minutes rewriting one weak paragraph.',
  },
  reading: {
    label: 'Reading',
    examFacts: [
      'IELTS Reading includes 40 questions in 60 minutes and rewards accurate evidence matching.',
      'Most score loss happens in question-type transitions and time overrun, not passage difficulty alone.',
      'Keyword synonym recognition is essential because answer lines are frequently paraphrased.'
    ],
    keyMethod: [
      'Skim for passage structure first, then scan for evidence only when question intent is clear.',
      'Treat each answer as evidence-based: locate line, verify meaning, then commit.',
      'Use checkpoint timing so you do not overinvest in one question set.'
    ],
    commonMistakes: [
      'Choosing answers from topic familiarity instead of exact passage evidence.',
      'Spending too long on one uncertain item and losing later easy marks.',
      'Missing paraphrases because only exact keywords were searched.'
    ],
    timedDrill:
      'Do one 20-question reading set in 30 minutes, then annotate every incorrect answer with the exact evidence line and error cause.',
  },
  listening: {
    label: 'Listening',
    examFacts: [
      'IELTS Listening has 4 sections and 40 questions with increasing complexity.',
      'The test rewards prediction and distractor handling more than raw memory.',
      'Answer formatting, spelling, and singular/plural accuracy can directly affect the final score.'
    ],
    keyMethod: [
      'Preview instructions and predict answer type before audio starts.',
      'Listen for changes in speaker intent (corrections, reversals, contrast words).',
      'Audit every wrong answer by classifying it as distractor, vocabulary, speed, or transfer error.'
    ],
    commonMistakes: [
      'Starting without answer-type prediction and missing early cues.',
      'Selecting first-match phrases before hearing full sentence context.',
      'Dropping marks on spelling and plural forms during answer completion.'
    ],
    timedDrill:
      'Run one full section under exam timing, then replay only missed items with transcript and write the exact trigger you missed.',
  },
  vocabulary: {
    label: 'Vocabulary',
    examFacts: [
      'IELTS rewards precise, natural word choice and collocations more than rare words.',
      'Lexical resource scores depend on range + accuracy, not memorized lists alone.',
      'Vocabulary gains are strongest when reused across speaking and writing outputs.'
    ],
    keyMethod: [
      'Build topic clusters with collocations and example sentences, not isolated terms.',
      'Recycle new words in speaking recordings and writing paragraphs the same week.',
      'Replace forced or unnatural words with simpler accurate alternatives.'
    ],
    commonMistakes: [
      'Memorizing advanced words without usage context.',
      'Using idioms in inappropriate or unnatural contexts.',
      'Ignoring collocations and preposition patterns.'
    ],
    timedDrill:
      'Create 12 words for one IELTS topic, write 8 collocations, then use at least 6 in a timed speaking or writing response.',
  },
  'exam-strategy': {
    label: 'Exam Strategy',
    examFacts: [
      'Stable score movement depends on consistent weekly cycles: targeted drills + full checkpoints.',
      'Mock tests reveal transition and stamina issues that single-module drills can miss.',
      'Study plans work best when each week has measurable output and one priority weakness.'
    ],
    keyMethod: [
      'Set weekly targets by module and define one score movement objective per week.',
      'Alternate targeted drills with full mock checkpoints to validate transfer.',
      'Use an error log to prioritize the next practice block.'
    ],
    commonMistakes: [
      'Studying all modules equally even when one module is the bottleneck.',
      'Running mocks without post-mock diagnosis and action items.',
      'Changing methods too often instead of following one cycle for at least two weeks.'
    ],
    timedDrill:
      'Run a 90-minute strategy session: 30 minutes weak-module drill, 40 minutes mixed module test block, 20 minutes review and next-week planning.',
  },
  'band-scores': {
    label: 'Band Scores',
    examFacts: [
      'IELTS uses a 0-9 band scale with half-band increments for module and overall outcomes.',
      'Score movement is usually constrained by the weakest module, not the strongest one.',
      'Consistent rubric-based feedback is required to move from plateau bands.'
    ],
    keyMethod: [
      'Define your current band profile by module before choosing a target plan.',
      'Prioritize the one module with the highest score delta opportunity.',
      'Review descriptors and feedback after every timed practice cycle.'
    ],
    commonMistakes: [
      'Targeting a final band without module-level baseline data.',
      'Focusing only on strengths while weak modules remain unchanged.',
      'Using volume-only practice without rubric-based correction.'
    ],
    timedDrill:
      'Perform one diagnostic mini-mock per module in a single session and map each result to an actionable upgrade for the next 7 days.',
  },
  resources: {
    label: 'Resources',
    examFacts: [
      'Resource quality matters when materials mirror IELTS task structure and timing.',
      'Mixing too many resource types can dilute focus and reduce measurable improvement.',
      'A good resource stack supports practice, review, and progression tracking.'
    ],
    keyMethod: [
      'Select one primary resource path per module and one secondary review source.',
      'Map each resource to a specific objective (accuracy, speed, or strategy).',
      'Retire low-value resources that do not create measurable score gains.'
    ],
    commonMistakes: [
      'Collecting resources without integrating them into a weekly plan.',
      'Switching platforms before finishing a full learning cycle.',
      'Using passive resources without timed application.'
    ],
    timedDrill:
      'Audit your current resource stack in 20 minutes, keep only high-impact items, then schedule one timed session using each retained resource.',
  },
  faq: {
    label: 'FAQ',
    examFacts: [
      'FAQ pages should answer high-intent learner questions clearly in the first paragraph.',
      'Accuracy and source clarity are critical for policy and scoring questions.',
      'Strong FAQ content should point to a next practical action, not only definitions.'
    ],
    keyMethod: [
      'Start with direct answers, then expand with one practical example.',
      'Link each answer to one related guide route for depth.',
      'Use current official references for format and scoring claims.'
    ],
    commonMistakes: [
      'Writing vague answers that do not resolve the actual learner question.',
      'Missing source-backed explanation on scoring or test format topics.',
      'Failing to provide next-step links after the answer.'
    ],
    timedDrill:
      'Select three learner questions, answer each in under 90 words, and attach one next-route action for each answer.',
  },
  updates: {
    label: 'Updates',
    examFacts: [
      'Update pages should include date context and explain why the change matters for preparation.',
      'Learners need immediate actions, not only announcements.',
      'Updates should connect to evergreen guide routes for implementation.'
    ],
    keyMethod: [
      'Summarize what changed, who it affects, and what to do this week.',
      'Add one short implementation checklist for immediate adoption.',
      'Link to stable practice routes to prevent context loss.'
    ],
    commonMistakes: [
      'Publishing update headlines without practical learner actions.',
      'Leaving old update content without date/context labels.',
      'Treating updates as isolated posts with no route integration.'
    ],
    timedDrill:
      'Convert one update into a 30-minute practical checklist and execute one action immediately after reading.',
  },
  offers: {
    label: 'Offers',
    examFacts: ['Offer pages are not part of the active IELTS guide surface.'],
    keyMethod: ['Use core guide routes for preparation workflows.'],
    commonMistakes: ['Using promotional pages as learning resources.'],
    timedDrill: 'Switch to a module guide and run one timed drill.'
  },
  membership: {
    label: 'Membership',
    examFacts: ['Membership pages are not part of the active IELTS guide surface.'],
    keyMethod: ['Use core guide routes for preparation workflows.'],
    commonMistakes: ['Treating account pages as study content.'],
    timedDrill: 'Switch to a module guide and run one timed drill.'
  }
};

const TOPIC_OVERRIDES: TopicOverride[] = [
  {
    pattern: /speaking\/part-2|cue-card/,
    directAnswer:
      'For IELTS Speaking Part 2, the fastest improvement comes from a repeatable 60-second planning frame and a stable 2-minute delivery structure: context, details, and reflection.',
    method: [
      'During the 1-minute prep, write only keywords for who/what/where/why and one mini-story.',
      'Speak in 3 clear blocks: set-up (20-30s), detail build (70-80s), reflection (20-30s).',
      'End with one conclusion sentence to avoid abrupt finish and hesitation.'
    ],
    mistakes: [
      'Using full-sentence notes and running out of prep time.',
      'Listing ideas without narrative flow.',
      'Pausing too long when shifting from description to opinion.'
    ],
    drill:
      'Run 3 cue cards back-to-back: 1 minute planning + 2 minute talk each, then replay and score fluency breaks at 30-second intervals.',
    takeaways: [
      'Cue-card stability is built on planning quality, not memorized scripts.',
      'Two-minute control is easier with a fixed 3-block speaking structure.',
      'Post-record review should target pause clusters and filler words.'
    ],
    checklist: [
      'I used keyword notes only during prep.',
      'I spoke for the full 2 minutes with clear structure.',
      'I identified at least 2 fluency upgrades for my next attempt.'
    ],
    geoQuestions: [
      'How do I structure a 2-minute IELTS cue-card answer without memorizing?',
      'What should I write in the 1-minute planning phase for Part 2?',
      'How can I reduce pauses during IELTS Speaking Part 2?'
    ],
    faqItems: [
      {
        question: 'How long should IELTS Speaking Part 2 answers be?',
        answer:
          'Aim to use the full two minutes. The goal is coherent development with stable pacing rather than very fast speech.'
      },
      {
        question: 'Should I memorize model stories for cue cards?',
        answer:
          'No. Memorized scripts often collapse under follow-up questions. Use flexible idea frameworks and personal examples.'
      }
    ]
  },
  {
    pattern: /speaking\/part-3|follow-up/,
    directAnswer:
      'Part 3 scores improve when answers are argument-based: clear claim, reason, example, and a short implication.',
    method: [
      'Open with a direct viewpoint in one sentence.',
      'Extend with one reason and one real-world example.',
      'Add a compare/contrast or consequence sentence for depth.'
    ],
    mistakes: [
      'Giving only short opinions without explanation.',
      'Using complex grammar that reduces clarity.',
      'Ignoring abstract social-level framing in Part 3 prompts.'
    ],
    drill:
      'Answer 10 Part 3 questions at 45-60 seconds each, then rewrite the weakest 3 answers into claim-reason-example format.',
    takeaways: [
      'Part 3 rewards depth and logic more than speed.',
      'Argument structure prevents vague answers.',
      'Abstract questions still need concrete examples.'
    ],
    checklist: [
      'I answered with claim + reason + example.',
      'I included one comparison or implication.',
      'I avoided unsupported general statements.'
    ],
    geoQuestions: [
      'What is the best format for IELTS Speaking Part 3 answers?',
      'How long should a Part 3 response be?',
      'How can I make abstract IELTS speaking answers clearer?'
    ],
    faqItems: [
      {
        question: 'Is IELTS Speaking Part 3 about opinion or analysis?',
        answer:
          'It is both. You should state your opinion and support it with analysis and examples.'
      },
      {
        question: 'How do I avoid repetitive Part 3 answers?',
        answer: 'Use different framing patterns: compare causes, effects, policy responses, and future implications.'
      }
    ]
  },
  {
    pattern: /writing\/task-2|opinion-essay/,
    directAnswer:
      'Task 2 performance improves when you choose one clear position and keep paragraph logic tightly connected to the prompt.',
    method: [
      'Spend 5 minutes planning thesis + paragraph purpose before drafting.',
      'Develop each body paragraph with one main claim and one concrete example.',
      'Leave final 5 minutes to tighten grammar and cohesion.'
    ],
    mistakes: [
      'Changing position between introduction and body paragraphs.',
      'Writing long introductions instead of developing arguments.',
      'Using memorized templates that do not match the task type.'
    ],
    drill:
      'Write one full Task 2 response in 40 minutes and spend 15 minutes auditing task response, coherence, and grammar correction.',
    takeaways: [
      'Task 2 carries higher weight in Writing scoring.',
      'Strong structure usually beats complex but unstable language.',
      'Planning time reduces off-topic drift.'
    ],
    checklist: [
      'My thesis directly answers the question.',
      'Each body paragraph has one clear argument and support.',
      'I checked grammar hotspots before submission.'
    ],
    geoQuestions: [
      'How do I structure IELTS Writing Task 2 for Band 7+?',
      'How much time should I spend planning Task 2?',
      'What are the top reasons candidates lose marks in Task 2?'
    ],
    faqItems: [
      {
        question: 'Does IELTS Writing Task 2 have a recommended word count?',
        answer: 'The minimum is 250 words, but quality and relevance matter more than writing excessively long essays.'
      },
      {
        question: 'Should I use complex vocabulary in every sentence?',
        answer: 'No. Prioritize accurate and natural language with clear argument flow.'
      }
    ]
  },
  {
    pattern: /writing\/task-1|general-letter|academic/,
    directAnswer:
      'Task 1 scores improve when you highlight key features first and avoid describing every detail line-by-line.',
    method: [
      'Identify the biggest trends or required bullet points before writing.',
      'Write an overview early so your response has clear direction.',
      'Group related data or ideas instead of isolated sentences.'
    ],
    mistakes: [
      'Listing every chart number instead of selecting key comparisons.',
      'Missing one required bullet point in General Training letters.',
      'Using opinion language in Academic data reports.'
    ],
    drill:
      'Complete one Task 1 response in 20 minutes and then underline where you covered each required feature or bullet point.',
    takeaways: [
      'Task 1 is a precision task: relevant coverage and accurate language.',
      'Overview quality strongly impacts perceived coherence.',
      'Grouping information improves clarity and score potential.'
    ],
    checklist: [
      'I included a clear overview or purpose paragraph.',
      'I covered all required data points/bullets.',
      'I used accurate comparison language.'
    ],
    geoQuestions: [
      'How should I write IELTS Writing Task 1 overview statements?',
      'What is the best structure for IELTS General Training letters?',
      'How do I avoid losing marks in Task 1 data description?'
    ],
    faqItems: [
      {
        question: 'How long should Task 1 writing be?',
        answer: 'Aim for at least 150 words with full coverage of required features.'
      },
      {
        question: 'Do I need a conclusion in Task 1?',
        answer: 'A brief closing line can help, but strong overview + organized body matters most.'
      }
    ]
  },
  {
    pattern: /reading\/question-types\/true-false-not-given|true-false-not-given/,
    directAnswer:
      'True/False/Not Given accuracy increases when each answer is tied to explicit passage evidence instead of intuition.',
    method: [
      'Locate the sentence block before deciding.',
      'Test for direct agreement (True), direct contradiction (False), or no stated evidence (Not Given).',
      'Annotate synonym/paraphrase pairs while checking evidence.'
    ],
    mistakes: [
      'Using world knowledge instead of passage evidence.',
      'Confusing False with Not Given when contradiction is not explicit.',
      'Skipping paraphrase matching and relying on keyword shape only.'
    ],
    drill:
      'Do 15 TFNG items in 20 minutes and write the evidence line number next to every answer.',
    takeaways: [
      'TFNG is an evidence test, not a topic comprehension test.',
      'Paraphrase detection is the core sub-skill.',
      'Line-level justification improves review quality.'
    ],
    checklist: [
      'I can point to evidence for every answer.',
      'I separated contradiction from missing information clearly.',
      'I logged paraphrase pairs that caused mistakes.'
    ],
    geoQuestions: [
      'How do I tell False vs Not Given in IELTS Reading?',
      'What is the fastest method for true/false/not given questions?',
      'How can I improve paraphrase recognition for IELTS Reading?'
    ],
    faqItems: [
      {
        question: 'When should I choose Not Given?',
        answer: 'Choose Not Given only when the passage does not confirm or contradict the statement directly.'
      },
      {
        question: 'Is keyword matching enough for TFNG?',
        answer: 'No. You must verify full meaning, including qualifiers and paraphrases.'
      }
    ]
  },
  {
    pattern: /matching-headings/,
    directAnswer:
      'Matching headings improves when you extract paragraph purpose first, then evaluate heading fit against the main idea.',
    method: [
      'Read first and final sentences to identify paragraph direction.',
      'Write a one-line gist before checking options.',
      'Eliminate headings that mention side details rather than central purpose.'
    ],
    mistakes: [
      'Choosing headings from single keywords only.',
      'Ignoring paragraph purpose and selecting detail-level options.',
      'Reading options too early and biasing comprehension.'
    ],
    drill:
      'Complete one headings set in 15 minutes, then rewrite each paragraph gist in 12 words max.',
    takeaways: [
      'Main-idea extraction is the core skill for headings.',
      'Option elimination is often faster than direct selection.',
      'Gist notes reduce distractor errors.'
    ],
    checklist: [
      'I created a gist sentence before selecting.',
      'I matched heading to purpose, not detail.',
      'I tracked distractor patterns in wrong options.'
    ],
    geoQuestions: [
      'What is the best strategy for IELTS matching headings?',
      'How can I find paragraph main ideas quickly?',
      'Why do I keep choosing distractor headings in IELTS Reading?'
    ],
    faqItems: [
      {
        question: 'Should I read heading options before the passage?',
        answer: 'Usually no. Build paragraph gist first, then compare options to avoid confirmation bias.'
      },
      {
        question: 'How much time should I spend on matching headings?',
        answer: 'Use strict checkpoints and avoid overinvesting; accuracy comes from gist clarity, not long rereads.'
      }
    ]
  },
  {
    pattern: /listening\/question-types\/multiple-choice|multiple-choice/,
    directAnswer:
      'Listening multiple-choice performance improves when you predict option differences and track decision changes in the audio.',
    method: [
      'Highlight keyword differences across options before audio starts.',
      'Listen for contrast and correction markers (however, actually, but, instead).',
      'Delay final selection until the full decision sentence is complete.'
    ],
    mistakes: [
      'Choosing the first option that matches a heard word.',
      'Missing corrected information after an initial statement.',
      'Not tracking speaker viewpoint shifts.'
    ],
    drill:
      'Practice one MC set daily and annotate each distractor trigger that caused the wrong choice.',
    takeaways: [
      'Multiple choice is a distractor-management task.',
      'Option-difference mapping improves attention allocation.',
      'Decision-change language is the highest-value cue.'
    ],
    checklist: [
      'I compared options before listening.',
      'I marked where the final decision occurred.',
      'I logged distractor words from wrong answers.'
    ],
    geoQuestions: [
      'How do I avoid distractors in IELTS listening multiple choice?',
      'What should I read first in IELTS listening options?',
      'How can I identify the final answer change in listening audio?'
    ],
    faqItems: [
      {
        question: 'Why do I lose marks in listening multiple choice?',
        answer: 'Most losses come from early answer selection before the speaker finishes clarifying or correcting details.'
      },
      {
        question: 'Should I write notes for every sentence?',
        answer: 'No. Focus on decision points and option differences.'
      }
    ]
  },
  {
    pattern: /map-labelling|map-labeling/,
    directAnswer:
      'Map labelling improves when you orient quickly, track movement sequence, and focus on positional language in real time.',
    method: [
      'Identify the start point, orientation, and landmark anchors before audio.',
      'Track route movement step by step rather than visualizing the whole map at once.',
      'Translate directional phrases into immediate map movement actions.'
    ],
    mistakes: [
      'Not confirming map orientation at the beginning.',
      'Losing position after one missed instruction.',
      'Ignoring location prepositions and directional modifiers.'
    ],
    drill:
      'Complete two map sections in one sitting, then replay and mark every directional phrase directly on the map.',
    takeaways: [
      'Orientation setup controls map-labelling accuracy.',
      'Direction vocabulary should be trained as action cues.',
      'Route-sequence tracking beats static map memorization.'
    ],
    checklist: [
      'I identified the start and orientation before listening.',
      'I tracked route movement in sequence.',
      'I logged missed directional phrases for review.'
    ],
    geoQuestions: [
      'How do I improve IELTS listening map labelling?',
      'Which directional words are most important for map questions?',
      'How can I recover after missing one map instruction?'
    ],
    faqItems: [
      {
        question: 'Should I memorize the full map before audio?',
        answer: 'No. Focus on start point, landmarks, and directional cue handling.'
      },
      {
        question: 'What causes most map labelling mistakes?',
        answer: 'Losing orientation and missing route-sequence transitions.'
      }
    ]
  },
  {
    pattern: /full-mock|mock-test|study-plan|time-management|band-7|band-8|academic-vs-general/,
    directAnswer:
      'Strategy pages are most useful when translated into weekly execution cycles with measurable outputs and review checkpoints.',
    method: [
      'Define one target outcome and one bottleneck module for the current week.',
      'Run targeted drills on weekdays and one full checkpoint session each week.',
      'Use post-session review to set next-week priorities.'
    ],
    mistakes: [
      'Reading strategy content without turning it into a schedule.',
      'Skipping full-checkpoint sessions and relying only on isolated drills.',
      'Tracking effort hours instead of score-linked outcomes.'
    ],
    drill:
      'Create a 7-day plan with one daily module block and one weekend checkpoint test, then review score trend against baseline.',
    takeaways: [
      'Consistency and review loops produce faster score movement than random volume.',
      'A good plan always links actions to measurable outcomes.',
      'Mock checkpoints validate whether strategy transfers under exam pressure.'
    ],
    checklist: [
      'I set one weekly score objective.',
      'I completed both targeted drills and a checkpoint session.',
      'I updated next-week priorities from real results.'
    ],
    geoQuestions: [
      'What is a realistic IELTS study plan for my timeline?',
      'How often should I take full IELTS mock tests?',
      'How do I improve one module without neglecting the others?'
    ],
    faqItems: [
      {
        question: 'How often should I run full IELTS mocks?',
        answer: 'For most learners, one full checkpoint every 7-14 days is enough when combined with targeted daily drills.'
      },
      {
        question: 'Can I reach a higher band with strategy only?',
        answer: 'No. Strategy must be paired with timed execution and correction-driven practice.'
      }
    ]
  }
];

function humanize(value: string): string {
  return value
    .split('/')
    .flatMap(part => part.split('-'))
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(input: string | undefined): string {
  return String(input || '').trim().toLowerCase();
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function findTopicOverride(canonicalPath: string): TopicOverride | null {
  const safePath = normalizeText(canonicalPath);
  for (const item of TOPIC_OVERRIDES) {
    if (item.pattern.test(safePath)) {
      return item;
    }
  }
  return null;
}

function ensureTitle(page: GuidePageDetail): string {
  if (page.title?.trim()) {
    return page.title.trim();
  }

  const segments = normalizeIeltsPath(page.canonicalPath)
    .split('/')
    .filter(Boolean)
    .slice(2);

  if (!segments.length) {
    return `${MODULE_PROFILES[page.module].label} IELTS Guide`;
  }

  return humanize(segments.join('/'));
}

function topicLabelFromPath(canonicalPath: string): string {
  const segments = normalizeIeltsPath(canonicalPath).split('/').filter(Boolean).slice(2);
  if (!segments.length) {
    return 'core preparation';
  }
  return humanize(segments.join('/')).toLowerCase();
}

function buildSmartSummaryExcerpt(input: { title: string; module: GuideModule; canonicalPath: string; currentExcerpt?: string }): string {
  const current = (input.currentExcerpt || '').trim();
  const topic = topicLabelFromPath(input.canonicalPath);
  const moduleLabel = MODULE_PROFILES[input.module].label;

  if (current.length >= 90 && !PLACEHOLDER_PATTERNS.some(pattern => pattern.test(current))) {
    return current;
  }

  return `${moduleLabel} guide for ${topic}: direct exam-format facts, high-impact mistakes to avoid, and timed practice steps that convert strategy into measurable score progress.`;
}

function needsGuideDetailEnrichment(page: GuidePageDetail): boolean {
  const joined = [
    page.excerpt,
    page.metaDescription,
    page.bodyMarkdown,
    page.practiceBlocks?.quickAnswer,
    ...(page.practiceBlocks?.commonMistakes || []),
    ...(page.faqItems || []).flatMap(item => [item.question, item.answer])
  ]
    .map(value => String(value || ''))
    .join('\n')
    .toLowerCase();

  const tooShort = (page.bodyMarkdown || '').trim().length < 420;
  const weakPractice = !Array.isArray(page.practiceBlocks?.stepByStepMethod) || page.practiceBlocks!.stepByStepMethod!.length < 3;
  const weakFaq = !Array.isArray(page.faqItems) || page.faqItems.length < 2;
  const hasPlaceholderSignal = PLACEHOLDER_PATTERNS.some(pattern => pattern.test(joined));

  return tooShort || weakPractice || weakFaq || hasPlaceholderSignal;
}

function buildDefaultFaqItems(input: {
  module: GuideModule;
  title: string;
  topicLabel: string;
  sourceUrls: string[];
}): Array<{ question: string; answer: string }> {
  const moduleLabel = MODULE_PROFILES[input.module].label;
  const sourcesText = input.sourceUrls.slice(0, 2).join(' and ');

  return [
    {
      question: `What is the fastest way to improve ${input.topicLabel}?`,
      answer:
        'Use one focused timed drill, score the output against rubric criteria, then immediately repeat with one targeted correction.'
    },
    {
      question: `How should I use this ${moduleLabel.toLowerCase()} guide during the week?`,
      answer:
        'Run short daily drills for technique and one checkpoint session each week to confirm improvement transfer under exam conditions.'
    },
    {
      question: 'Which sources should I trust for IELTS format and scoring?',
      answer: `Start with official IELTS resources for format and scoring detail, then use this route for practical execution: ${sourcesText}.`
    }
  ];
}

function buildDefaultGeoQuestions(module: GuideModule, topicLabel: string): string[] {
  const moduleLabel = MODULE_PROFILES[module].label;
  return [
    `How can I improve ${topicLabel} for IELTS quickly?`,
    `What is the best ${moduleLabel.toLowerCase()} strategy for IELTS band improvement?`,
    `What timed practice routine works for ${topicLabel}?`
  ];
}

function buildDefaultChecklist(module: GuideModule): string[] {
  return [
    'I completed one full timed drill for this route.',
    `I reviewed my output against ${MODULE_PROFILES[module].label.toLowerCase()} scoring criteria.`,
    'I selected one specific correction for the next session.',
    'I queued one related route as the immediate next step.'
  ];
}

function buildBodyMarkdown(input: {
  title: string;
  module: GuideModule;
  topicLabel: string;
  quickAnswer: string;
  examFacts: string[];
  method: string[];
  mistakes: string[];
  drill: string;
  geoQuestions: string[];
  sourceUrls: string[];
}): string {
  const moduleLabel = MODULE_PROFILES[input.module].label;
  return [
    `# ${input.title}`,
    '',
    '## Direct answer',
    input.quickAnswer,
    '',
    `## What this ${moduleLabel.toLowerCase()} route covers`,
    `This page focuses on ${input.topicLabel} with exam-relevant method, realistic timing, and correction-first practice loops.`,
    '',
    '## Factual IELTS framework',
    ...input.examFacts.map(item => `- ${item}`),
    '',
    '## Step-by-step execution method',
    ...input.method.map((item, index) => `${index + 1}. ${item}`),
    '',
    '## Timed practice drill',
    input.drill,
    '',
    '## Common mistakes and how to fix them',
    ...input.mistakes.map(item => `- ${item}`),
    '',
    '## High-intent learner questions (GEO)',
    ...input.geoQuestions.map(item => `- ${item}`),
    '',
    '## Source-backed references',
    ...input.sourceUrls.map(url => `- ${url}`)
  ].join('\n');
}

function buildEnrichedGuideDetail(page: GuidePageDetail): GuidePageDetail {
  const moduleProfile = MODULE_PROFILES[page.module];
  const normalizedPath = normalizeIeltsPath(page.canonicalPath);
  const title = ensureTitle(page);
  const topicLabel = topicLabelFromPath(normalizedPath);
  const override = findTopicOverride(normalizedPath);

  const sourceUrls = uniqueStrings([...SHARED_SOURCE_URLS, ...(page.sourceUrls || [])]);

  const quickAnswer =
    override?.directAnswer ||
    `Use this ${moduleProfile.label.toLowerCase()} route for ${topicLabel} with one timed session, rubric-based correction, and immediate next-route progression.`;

  const method = override?.method || moduleProfile.keyMethod;
  const mistakes = override?.mistakes || moduleProfile.commonMistakes;
  const drill = override?.drill || moduleProfile.timedDrill;
  const takeaways = uniqueStrings([
    ...(override?.takeaways || []),
    ...moduleProfile.examFacts.slice(0, 2),
    `Use this ${moduleProfile.label.toLowerCase()} route as part of a weekly practice cycle, not one-off reading.`
  ]);
  const checklist = uniqueStrings([...(override?.checklist || []), ...buildDefaultChecklist(page.module)]);
  const geoQuestions = uniqueStrings([...(override?.geoQuestions || []), ...buildDefaultGeoQuestions(page.module, topicLabel)]);
  const faqItems =
    override?.faqItems && override.faqItems.length > 0
      ? [...override.faqItems, ...buildDefaultFaqItems({ module: page.module, title, topicLabel, sourceUrls })].slice(0, 6)
      : buildDefaultFaqItems({ module: page.module, title, topicLabel, sourceUrls }).slice(0, 6);

  const excerpt = buildSmartSummaryExcerpt({
    title,
    module: page.module,
    canonicalPath: normalizedPath,
    currentExcerpt: page.excerpt
  });

  const rawMetaDescription = page.metaDescription || '';
  const metaDescription =
    rawMetaDescription.length >= 110 && !PLACEHOLDER_PATTERNS.some(pattern => pattern.test(rawMetaDescription))
      ? rawMetaDescription
      : `${title}: practical ${moduleProfile.label.toLowerCase()} strategy, exam facts, common pitfalls, and timed drills for score improvement.`;

  const shouldReplaceBody = needsGuideDetailEnrichment(page);
  const bodyMarkdown = shouldReplaceBody
    ? buildBodyMarkdown({
        title,
        module: page.module,
        topicLabel,
        quickAnswer,
        examFacts: moduleProfile.examFacts,
        method,
        mistakes,
        drill,
        geoQuestions,
        sourceUrls
      })
    : page.bodyMarkdown || '';

  return {
    ...page,
    title,
    metaTitle: page.metaTitle || `${title} | Spokio IELTS Guide`,
    metaDescription,
    excerpt,
    bodyMarkdown,
    keyTakeaways: takeaways,
    faqItems,
    practiceBlocks: {
      quickAnswer,
      commonMistakes: mistakes,
      stepByStepMethod: method,
      timedPracticeDrill: drill,
      selfCheckChecklist: checklist
    },
    sourceUrls
  };
}

function enrichGuideSummary<T extends { title: string; excerpt?: string; module: GuideModule; canonicalPath: string }>(item: T): T {
  return {
    ...item,
    excerpt: buildSmartSummaryExcerpt({
      title: item.title,
      module: item.module,
      canonicalPath: item.canonicalPath,
      currentExcerpt: item.excerpt
    })
  };
}

function enrichTreeNode(node: GuideTreeNode): GuideTreeNode {
  return {
    ...enrichGuideSummary(node),
    children: (node.children || []).map(child => enrichTreeNode(child))
  };
}

export function enrichGuideDetailResponse(response: GuideDetailResponse): GuideDetailResponse {
  return {
    page: buildEnrichedGuideDetail(response.page),
    related: (response.related || []).map(item => enrichGuideSummary(item))
  };
}

export function enrichGuideTreeResponse(response: GuideTreeResponse): GuideTreeResponse {
  return {
    ...response,
    flat: (response.flat || []).map(item => enrichGuideSummary(item)),
    tree: (response.tree || []).map(node => enrichTreeNode(node))
  };
}
