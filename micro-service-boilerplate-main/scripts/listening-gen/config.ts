import path from 'path';

/* ------------------------------------------------------------------ */
/*  Pipeline configuration                                            */
/* ------------------------------------------------------------------ */

export const PIPELINE_CONFIG = {
  sectionsPerType: Number(process.env.LISTENING_SECTIONS_PER_TYPE) || 150,
  testsToCompose: Number(process.env.LISTENING_TESTS_TO_COMPOSE) || 500,
  batchSize: Number(process.env.LISTENING_BATCH_SIZE) || 5,
  stateDir: path.join(process.cwd(), '.listening-gen-state'),
  audioOutputDir: path.join(process.cwd(), '.listening-gen-state', 'audio'),
  contentOutputDir: path.join(process.cwd(), '.listening-gen-state', 'content'),
  supabaseBucket: process.env.SUPABASE_LISTENING_BUCKET || 'listening-audio',
  supabaseBucketPublic: true,
  claudeModel: process.env.LISTENING_CLAUDE_MODEL || 'claude-sonnet-4-5-20241022',
};

export const SECTION_TYPES = ['s1', 's2', 's3', 's4'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/* ------------------------------------------------------------------ */
/*  Edge TTS voice map                                                */
/* ------------------------------------------------------------------ */

export const VOICE_MAP = {
  // British
  british_female_1: 'en-GB-SoniaNeural',
  british_male_1: 'en-GB-RyanNeural',
  british_female_2: 'en-GB-LibbyNeural',
  british_male_2: 'en-GB-ThomasNeural',
  british_female_3: 'en-GB-MaisieNeural',
  // Australian
  australian_female: 'en-AU-NatashaNeural',
  australian_male: 'en-AU-WilliamNeural',
  // New Zealand
  newzealand_female: 'en-NZ-MollyNeural',
  newzealand_male: 'en-NZ-MitchellNeural',
  // Canadian
  canadian_female: 'en-CA-ClaraNeural',
  canadian_male: 'en-CA-LiamNeural',
  // American
  american_female: 'en-US-JennyNeural',
  american_male: 'en-US-GuyNeural',
} as const;

/* ------------------------------------------------------------------ */
/*  Voice pools — rotated across sections for variety                 */
/* ------------------------------------------------------------------ */

export const SECTION_VOICE_POOLS = {
  /** Section 1: Dialogue, 2 speakers, everyday */
  s1: [
    { speakers: [{ label: 'Speaker A', voice: VOICE_MAP.british_female_1, gender: 'female' as const }, { label: 'Speaker B', voice: VOICE_MAP.british_male_1, gender: 'male' as const }] },
    { speakers: [{ label: 'Speaker A', voice: VOICE_MAP.australian_female, gender: 'female' as const }, { label: 'Speaker B', voice: VOICE_MAP.australian_male, gender: 'male' as const }] },
    { speakers: [{ label: 'Speaker A', voice: VOICE_MAP.canadian_female, gender: 'female' as const }, { label: 'Speaker B', voice: VOICE_MAP.british_male_2, gender: 'male' as const }] },
    { speakers: [{ label: 'Speaker A', voice: VOICE_MAP.newzealand_female, gender: 'female' as const }, { label: 'Speaker B', voice: VOICE_MAP.american_male, gender: 'male' as const }] },
    { speakers: [{ label: 'Speaker A', voice: VOICE_MAP.british_female_2, gender: 'female' as const }, { label: 'Speaker B', voice: VOICE_MAP.canadian_male, gender: 'male' as const }] },
    { speakers: [{ label: 'Speaker A', voice: VOICE_MAP.american_female, gender: 'female' as const }, { label: 'Speaker B', voice: VOICE_MAP.newzealand_male, gender: 'male' as const }] },
  ],
  /** Section 2: Monologue, 1 speaker, everyday */
  s2: [
    { speakers: [{ label: 'Narrator', voice: VOICE_MAP.british_female_1, gender: 'female' as const }] },
    { speakers: [{ label: 'Narrator', voice: VOICE_MAP.australian_male, gender: 'male' as const }] },
    { speakers: [{ label: 'Narrator', voice: VOICE_MAP.canadian_female, gender: 'female' as const }] },
    { speakers: [{ label: 'Narrator', voice: VOICE_MAP.british_male_2, gender: 'male' as const }] },
    { speakers: [{ label: 'Narrator', voice: VOICE_MAP.newzealand_female, gender: 'female' as const }] },
    { speakers: [{ label: 'Narrator', voice: VOICE_MAP.american_male, gender: 'male' as const }] },
  ],
  /** Section 3: Discussion, 2-3 speakers, educational */
  s3: [
    { speakers: [{ label: 'Student A', voice: VOICE_MAP.british_female_2, gender: 'female' as const }, { label: 'Student B', voice: VOICE_MAP.british_male_1, gender: 'male' as const }, { label: 'Tutor', voice: VOICE_MAP.australian_female, gender: 'female' as const }] },
    { speakers: [{ label: 'Student A', voice: VOICE_MAP.american_female, gender: 'female' as const }, { label: 'Student B', voice: VOICE_MAP.british_male_2, gender: 'male' as const }, { label: 'Student C', voice: VOICE_MAP.newzealand_female, gender: 'female' as const }] },
    { speakers: [{ label: 'Student A', voice: VOICE_MAP.canadian_male, gender: 'male' as const }, { label: 'Student B', voice: VOICE_MAP.british_female_1, gender: 'female' as const }, { label: 'Professor', voice: VOICE_MAP.australian_male, gender: 'male' as const }] },
    { speakers: [{ label: 'Student A', voice: VOICE_MAP.british_female_3, gender: 'female' as const }, { label: 'Student B', voice: VOICE_MAP.newzealand_male, gender: 'male' as const }] },
  ],
  /** Section 4: Monologue, 1 speaker, academic lecture */
  s4: [
    { speakers: [{ label: 'Lecturer', voice: VOICE_MAP.british_male_1, gender: 'male' as const }] },
    { speakers: [{ label: 'Lecturer', voice: VOICE_MAP.british_female_1, gender: 'female' as const }] },
    { speakers: [{ label: 'Lecturer', voice: VOICE_MAP.australian_female, gender: 'female' as const }] },
    { speakers: [{ label: 'Lecturer', voice: VOICE_MAP.newzealand_male, gender: 'male' as const }] },
    { speakers: [{ label: 'Lecturer', voice: VOICE_MAP.british_male_2, gender: 'male' as const }] },
    { speakers: [{ label: 'Lecturer', voice: VOICE_MAP.canadian_male, gender: 'male' as const }] },
  ],
};

/* ------------------------------------------------------------------ */
/*  Question type pools per section (IELTS conventions)               */
/* ------------------------------------------------------------------ */

export const SECTION_QUESTION_TYPE_POOLS: Record<SectionType, string[]> = {
  s1: ['sentence_completion', 'note_table_flow_completion', 'multiple_choice_single', 'short_answer'],
  s2: ['multiple_choice_single', 'matching_features', 'note_table_flow_completion', 'sentence_completion', 'diagram_label_completion'],
  s3: ['multiple_choice_single', 'multiple_choice_multiple', 'matching_features', 'sentence_completion', 'short_answer'],
  s4: ['sentence_completion', 'summary_completion', 'note_table_flow_completion', 'short_answer', 'multiple_choice_single'],
};

/* ------------------------------------------------------------------ */
/*  Topic pools (40+ per section type)                                */
/* ------------------------------------------------------------------ */

export const SECTION_TOPICS: Record<SectionType, string[]> = {
  s1: [
    'booking a hotel room', 'enquiring about gym membership', 'arranging a house repair',
    'registering for a community event', 'calling about a lost item', 'booking a guided tour',
    'opening a bank account', 'arranging furniture delivery', 'enquiring about a language course',
    'complaining about a product', 'reserving a table at a restaurant', 'signing up for a library card',
    'renting a car for a weekend trip', 'making a dental appointment', 'ordering a birthday cake',
    'booking a moving service', 'enquiring about pet boarding', 'joining a sports club',
    'arranging a childcare visit', 'reporting a maintenance issue', 'booking airport parking',
    'enquiring about an insurance claim', 'registering for a charity run', 'arranging a home internet installation',
    'calling about a parcel delivery', 'booking a photography session', 'enquiring about volunteering opportunities',
    'subscribing to a meal delivery service', 'contacting a travel agency about a package holiday',
    'reporting a noise complaint to a landlord', 'requesting a replacement credit card',
    'booking a spa treatment', 'renting a storage unit', 'arranging a plumbing repair',
    'enquiring about a cooking class', 'buying concert tickets by phone', 'enrolling a child in swimming lessons',
    'setting up a direct debit for council tax', 'changing a flight reservation',
    'enquiring about home cleaning services',
  ],
  s2: [
    'public library orientation', 'local council waste recycling programme', 'museum exhibition guide',
    'neighbourhood safety programme', 'health centre new patient information', 'workplace fire safety briefing',
    'community garden volunteer induction', 'local transport network update', 'national park visitor centre talk',
    'town festival event schedule', 'school open day welcome address', 'shopping centre refurbishment announcement',
    'new community swimming pool facilities', 'city council housing update', 'local food bank operations briefing',
    'guided walking tour of a historic quarter', 'airport terminal orientation', 'animal shelter adoption process',
    'beach safety awareness presentation', 'cycle-to-work scheme introduction',
    'community arts centre programme launch', 'village hall renovation plans', 'hospital visitor guidelines',
    'charity shop volunteer training', 'tourist information centre update', 'farmers market regulations briefing',
    'children\'s playground safety features tour', 'university campus tour for parents',
    'neighbourhood watch scheme launch', 'waste water treatment plant educational visit',
    'public swimming pool rules and schedule', 'local heritage trail guide',
    'renewable energy community project briefing', 'new bus route network explanation',
    'sports day organisation talk', 'botanical garden seasonal highlights tour',
    'youth centre programme overview', 'council road works disruption update',
    'cinema complex opening event guide', 'pet registration and microchipping information session',
  ],
  s3: [
    'discussing a group presentation on climate change', 'planning research methodology for a dissertation',
    'comparing internship placement options', 'reviewing lecture notes on marine biology',
    'choosing a topic for a final-year project', 'evaluating survey results for a psychology study',
    'debating renewable energy policies for a seminar', 'organising a field trip for geography students',
    'analysing case studies in business management', 'preparing for a group debate on media ethics',
    'discussing findings from a sociology experiment', 'planning a documentary for a film studies module',
    'comparing theories of child development', 'organising a peer tutoring programme',
    'reviewing sources for an archaeology essay', 'debating the impact of social media on education',
    'planning a science fair exhibit', 'evaluating different statistical methods for data analysis',
    'discussing feedback on a literature review draft', 'comparing study abroad programme options',
    'planning a campus sustainability initiative', 'analysing results of an engineering prototype test',
    'discussing ethical concerns in genetic research', 'organising a charity fundraiser for a student society',
    'reviewing progress on a joint computer science project', 'comparing assessment strategies in primary education',
    'planning a student newspaper issue', 'discussing the design of a public health campaign',
    'evaluating teaching methods in language learning', 'analysing historical sources for a history seminar',
    'planning a music recital programme', 'discussing laboratory safety procedures for chemistry students',
    'comparing urban and rural healthcare delivery models', 'reviewing an architecture design portfolio',
    'organising a sports tournament for multiple departments', 'discussing AI applications in healthcare',
    'planning a cross-cultural communication workshop', 'evaluating water quality testing methods',
    'discussing the effectiveness of online learning platforms', 'comparing career pathways in environmental science',
  ],
  s4: [
    'the history of urban planning', 'cognitive biases in decision making',
    'sustainable agriculture methods', 'ocean acidification and marine ecosystems',
    'the evolution of written language', 'behavioural economics in public policy',
    'plate tectonics and earthquake prediction', 'the psychology of colour perception',
    'climate migration patterns throughout history', 'artificial intelligence in medical diagnostics',
    'the development of renewable energy technologies', 'ancient trade routes and cultural exchange',
    'the science of sleep and memory consolidation', 'biodiversity loss in tropical rainforests',
    'the role of microbiomes in human health', 'the history and impact of vaccination programmes',
    'water scarcity and desalination technologies', 'the neuroscience of language acquisition',
    'conservation strategies for endangered species', 'the impact of urbanisation on bird populations',
    'deep sea exploration and hydrothermal vents', 'the economics of space exploration',
    'the archaeology of ancient civilisations', 'noise pollution and its effects on wildlife',
    'the development of modern transportation systems', 'volcanology and predicting eruptions',
    'the history of Antarctic exploration', 'genetic engineering in crop production',
    'the psychology of group conformity', 'coral reef restoration techniques',
    'the evolution of musical instruments', 'light pollution and astronomical observation',
    'the science of fermentation in food production', 'migration patterns of monarch butterflies',
    'the development of written legal codes', 'the physics of sound and acoustics',
    'the history of public health measures', 'robotics in manufacturing and logistics',
    'forest fire ecology and management', 'the cultural significance of storytelling traditions',
  ],
};

/* ------------------------------------------------------------------ */
/*  Audio synthesis settings                                          */
/* ------------------------------------------------------------------ */

export const AUDIO_CONFIG = {
  /** Pause between segments from the same speaker (seconds) */
  sameSpeakerPause: 0.5,
  /** Pause between different speakers (seconds) */
  differentSpeakerPause: 1.0,
  /** Pause before question boundary markers (seconds) */
  questionBoundaryPause: 2.0,
  /** Output format */
  format: 'mp3' as const,
  sampleRate: 44100,
  channels: 1,
  bitrate: '128k',
  /** FFmpeg loudnorm target */
  loudnormTarget: '-16',
  loudnormLRA: '11',
  loudnormTP: '-1.5',
};
