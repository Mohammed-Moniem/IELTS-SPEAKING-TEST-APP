import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

type ReadingTrack = 'academic' | 'general';
type SectionId = 'p1' | 'p2' | 'p3';

type ReadingQuestion = {
  questionId: string;
  sectionId: SectionId;
  groupId?: string;
  type:
    | 'multiple_choice_single'
    | 'multiple_choice_multiple'
    | 'true_false_not_given'
    | 'yes_no_not_given'
    | 'matching_headings'
    | 'matching_information'
    | 'matching_features'
    | 'matching_sentence_endings'
    | 'sentence_completion'
    | 'summary_completion'
    | 'note_table_flow_completion'
    | 'diagram_label_completion'
    | 'short_answer';
  prompt: string;
  instructions?: string;
  options?: string[];
  answerSpec: {
    kind: 'single' | 'multi' | 'ordered' | 'map';
    value: string | string[] | Record<string, string>;
    caseSensitive?: boolean;
    maxWords?: number;
  };
  correctAnswer?: string;
  explanation?: string;
};

type ReadingSection = {
  sectionId: SectionId;
  title: string;
  passageText: string;
  suggestedMinutes: number;
  questions: ReadingQuestion[];
};

dotenv.config({ path: path.join(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const TARGET_PER_TRACK = 500;
const BATCH_SIZE = 250;
const DRY_RUN = ['1', 'true', 'yes', 'on'].includes((process.env.READING_BANK_DRY_RUN || '').trim().toLowerCase());
const TRACKS: ReadingTrack[] = ['academic', 'general'];
const QUALITY_TIER = 'exam_v2';

/* ─────────────────── NEW TOPICS (50 per track, zero overlap with existing) ─────────────────── */

const TOPICS: Record<ReadingTrack, string[]> = {
  academic: [
    'deep-sea mineral extraction policy',
    'epigenetics and behavioural inheritance',
    'autonomous vehicle ethics frameworks',
    'coral reef bioengineering strategies',
    'quantum computing in cryptography',
    'neurodiversity in higher education',
    'space debris mitigation governance',
    'precision agriculture and soil health',
    'language extinction and digital archiving',
    'microplastics in freshwater ecosystems',
    'renewable hydrogen fuel infrastructure',
    'algorithmic bias in judicial sentencing',
    'permafrost thaw and methane emissions',
    'gene therapy for rare diseases',
    'urban vertical farming economics',
    'dark matter detection experiments',
    'antibiotic resistance in livestock',
    'indigenous knowledge in climate science',
    'blockchain for academic credential verification',
    'ocean acidification and shellfish industries',
    'geoengineering solar radiation management',
    'cognitive load theory in online learning',
    'wildfire prediction using satellite data',
    'nanotechnology in targeted drug delivery',
    'cultural heritage preservation through 3D scanning',
    'migration patterns and labour market adaptation',
    'rewilding and ecosystem restoration',
    'brain-computer interface development',
    'carbon capture and underground storage',
    'pandemic preparedness supply chain models',
    'machine translation and diplomatic communication',
    'tidal energy generation feasibility',
    'sleep science and academic performance',
    'synthetic biology and biosecurity risks',
    'deforestation monitoring with drone technology',
    'childhood bilingualism and cognitive flexibility',
    'volcanic activity forecasting methods',
    'ethical sourcing in global electronics supply',
    'desalination technology and coastal communities',
    'social media influence on political polarisation',
    'atmospheric river research and flood forecasting',
    'urban noise pollution health impacts',
    'genetic modification in cereal crops',
    'citizen science in biodiversity monitoring',
    'light pollution effects on wildlife behaviour',
    'digital twin technology in engineering',
    'glacial retreat and freshwater availability',
    'open-access publishing and research equity',
    'robotic surgery advancements and training',
    'circular economy in textile manufacturing',
  ],
  general: [
    'local farmers market organisation',
    'pet adoption and shelter services',
    'home recycling and waste sorting',
    'cycling infrastructure improvements',
    'community garden membership',
    'school parent-teacher communication',
    'mobile phone repair and sustainability',
    'neighbourhood watch modernisation',
    'charity shop volunteering',
    'home insurance claims process',
    'local swimming pool maintenance',
    'roadside assistance membership',
    'package delivery tracking systems',
    'tenant rights and rental agreements',
    'gym membership cancellation policies',
    'supermarket loyalty card programmes',
    'passport renewal procedures',
    'local council complaint handling',
    'second-hand car buying advice',
    'childcare subsidy applications',
    'workplace flexible hours negotiation',
    'domestic water leak prevention',
    'community centre event planning',
    'mobile banking security features',
    'restaurant hygiene inspection ratings',
    'home broadband speed complaints',
    'public park playground safety',
    'local pharmacy prescription services',
    'driving licence renewal process',
    'household pest control services',
    'train season ticket savings',
    'elderly care home selection',
    'wedding venue booking tips',
    'allotment garden waiting lists',
    'personal data protection rights',
    'airport parking comparison services',
    'student accommodation contracts',
    'local election voter registration',
    'bicycle theft prevention measures',
    'home energy meter reading guidance',
    'dental appointment booking systems',
    'fire safety equipment for homes',
    'community sports league registration',
    'holiday travel insurance comparison',
    'moving house checklist services',
    'public transport concession cards',
    'online shopping return policies',
    'veterinary emergency helplines',
    'roof repair contractor selection',
    'blood donation appointment scheduling',
  ],
};

/* ─── Variation pools for rich, diverse content per question type ─── */

const ACADEMIC_MC_SINGLE_PROMPTS = [
  { prompt: (p: number) => `According to paragraph ${p}, what is identified as the primary obstacle to effective implementation?`, options: ['Insufficient coordination between stakeholder groups hindered progress.', 'Increased budgets resolved all operational challenges immediately.', 'Public disclosure requirements were waived to speed up processes.', 'Regional oversight became redundant after the first phase.'], answer: 'Insufficient coordination between stakeholder groups hindered progress.' },
  { prompt: (p: number) => `What does paragraph ${p} suggest was the key driver of measurable improvement?`, options: ['Systematic data collection and transparent reporting frameworks.', 'A single large investment at the start of the programme.', 'Reducing the number of agencies involved in delivery.', 'Allowing each site complete autonomy without shared guidelines.'], answer: 'Systematic data collection and transparent reporting frameworks.' },
  { prompt: (p: number) => `In paragraph ${p}, the author attributes early setbacks mainly to which factor?`, options: ['Absence of standardised evaluation criteria across sites.', 'Overwhelming public enthusiasm causing resource strain.', 'Technology failures that were entirely unpredictable.', 'External funding bodies imposing unworkable deadlines.'], answer: 'Absence of standardised evaluation criteria across sites.' },
  { prompt: (p: number) => `Which statement best reflects the conclusion drawn in paragraph ${p}?`, options: ['Long-term success requires iterative review rather than one-off interventions.', 'Initial pilot results are always sufficient for scaling decisions.', 'Political commitment alone guarantees sustained improvement.', 'Automation can fully replace human oversight in complex systems.'], answer: 'Long-term success requires iterative review rather than one-off interventions.' },
  { prompt: (p: number) => `Paragraph ${p} indicates that the most reliable predictor of positive outcomes was which element?`, options: ['Disciplined governance structures with clear accountability.', 'The geographic location of participating institutions.', 'The total monetary value of the initial grant.', 'The personal charisma of programme directors.'], answer: 'Disciplined governance structures with clear accountability.' },
];

const GENERAL_MC_SINGLE_PROMPTS = [
  { prompt: (p: number) => `According to paragraph ${p}, what should customers do first when encountering a problem?`, options: ['Contact the service provider with documented evidence of the issue.', 'Wait several months to see if the problem resolves itself.', 'Share the complaint on social media before contacting the provider.', 'Hire a solicitor immediately to handle all communications.'], answer: 'Contact the service provider with documented evidence of the issue.' },
  { prompt: (p: number) => `Paragraph ${p} advises that the most effective way to save money is to do what?`, options: ['Compare multiple providers and read terms carefully before committing.', 'Always choose the cheapest option regardless of quality or reviews.', 'Avoid asking questions so the process moves faster.', 'Sign up for every loyalty programme available simultaneously.'], answer: 'Compare multiple providers and read terms carefully before committing.' },
  { prompt: (p: number) => `What does paragraph ${p} recommend as the best first step for new participants?`, options: ['Attend an introductory session to understand rules and expectations.', 'Begin full participation immediately without any preparation.', 'Read every available document before making any contact at all.', 'Ask neighbours to register on your behalf to save time.'], answer: 'Attend an introductory session to understand rules and expectations.' },
  { prompt: (p: number) => `According to paragraph ${p}, why do many people fail to complete the process on time?`, options: ['They underestimate the documentation requirements and leave it too late.', 'The service deliberately makes deadlines impossible to meet.', 'Computer systems are always offline during peak hours.', 'Staff members provide incorrect advice on purpose.'], answer: 'They underestimate the documentation requirements and leave it too late.' },
  { prompt: (p: number) => `In paragraph ${p}, what is suggested as the most common reason for customer dissatisfaction?`, options: ['Unclear communication about service timelines and expectations.', 'The service being entirely free of charge.', 'Having too many helpful staff available at once.', 'Overly generous refund policies causing confusion.'], answer: 'Unclear communication about service timelines and expectations.' },
];

const MC_MULTIPLE_VARIANTS = [
  { prompt: 'Choose THREE factors that the passage connects to improved results.', options: ['Transparent reporting mechanisms across all participants', 'Regular review meetings with designated accountability', 'Elimination of all external partnerships from the process', 'Rapid escalation of irregularities rather than postponement', 'Dependence on promotional materials instead of structural change'], answer: ['Transparent reporting mechanisms across all participants', 'Regular review meetings with designated accountability', 'Rapid escalation of irregularities rather than postponement'] },
  { prompt: 'Select THREE recommendations made by the researchers in this passage.', options: ['Establishing baseline measurements before launching initiatives', 'Using matched comparison groups for evaluation accuracy', 'Allowing each team to define success independently', 'Monitoring whether gains persist beyond initial novelty', 'Reducing data collection to simplify the evaluation process'], answer: ['Establishing baseline measurements before launching initiatives', 'Using matched comparison groups for evaluation accuracy', 'Monitoring whether gains persist beyond initial novelty'] },
  { prompt: 'Which THREE issues does the passage identify as barriers to progress?', options: ['Inconsistent definitions used across participating agencies', 'Excessive reliance on short-term pilot data for decisions', 'The availability of too much funding at every stage', 'Weak accountability structures delaying corrective action', 'Universal agreement on terminology from the very start'], answer: ['Inconsistent definitions used across participating agencies', 'Excessive reliance on short-term pilot data for decisions', 'Weak accountability structures delaying corrective action'] },
  { prompt: 'Choose THREE characteristics of programmes that achieved lasting improvements.', options: ['Incentives tied to verified outcomes rather than narrative claims', 'Disciplined follow-through on review cycle commitments', 'Removing all documentation requirements for efficiency', 'Shared measurement standards across all delivery sites', 'Relying solely on individual motivation without structure'], answer: ['Incentives tied to verified outcomes rather than narrative claims', 'Disciplined follow-through on review cycle commitments', 'Shared measurement standards across all delivery sites'] },
  { prompt: 'According to the passage, which THREE elements are essential for sustainability?', options: ['Cross-institutional alignment on risk classification', 'Root-cause investigation before incident closure', 'Reducing transparency to protect institutional reputation', 'Forecast-driven planning based on historical evidence', 'Centralising all decision-making in a single authority'], answer: ['Cross-institutional alignment on risk classification', 'Root-cause investigation before incident closure', 'Forecast-driven planning based on historical evidence'] },
];

const TFNG_VARIANTS = [
  { prompt: (p: number) => `Short-term pilot findings provide a reliable foundation for permanent policy changes according to paragraph ${p}.`, answer: 'False' },
  { prompt: (p: number) => `Paragraph ${p} states that technology upgrades were the single most important factor in achieving gains.`, answer: 'False' },
  { prompt: (p: number) => `The author in paragraph ${p} claims that seasonal demand variations rarely affect early performance data.`, answer: 'False' },
  { prompt: (p: number) => `According to paragraph ${p}, programmes with stronger governance structures showed more consistent outcomes.`, answer: 'True' },
  { prompt: (p: number) => `Paragraph ${p} mentions that all participating sites achieved identical levels of improvement.`, answer: 'Not Given' },
];

const YNNG_VARIANTS = [
  { prompt: 'Does the writer support the idea that initial measurement baselines can be omitted?', answer: 'No' },
  { prompt: 'Does the passage suggest that external accountability improves long-term delivery?', answer: 'Yes' },
  { prompt: 'Does the author agree that a single evaluation method is suitable for all contexts?', answer: 'No' },
  { prompt: 'According to the passage, do researchers believe novelty effects always persist over time?', answer: 'No' },
  { prompt: 'Does the writer consider matched comparison groups to be a useful evaluation method?', answer: 'Yes' },
];

const SENTENCE_ENDING_VARIANTS = [
  { options: ['A. when baseline data is collected systematically before launch.', 'B. because local variation is entirely eliminated.', 'C. if auditing processes are applied uniformly across sites.', 'D. after independent reviewers confirm root-cause analysis.', 'E. while stakeholders are kept unaware of trade-offs.', 'F. once escalation protocols are clearly documented.'], answer: 'D. after independent reviewers confirm root-cause analysis.' },
  { options: ['A. provided that oversight structures remain transparent.', 'B. when promotional campaigns replace process improvement.', 'C. after evaluation criteria are standardised across teams.', 'D. because funding alone determines programme success.', 'E. if accountability chains extend to front-line delivery.', 'F. unless all monitoring is conducted by external bodies.'], answer: 'E. if accountability chains extend to front-line delivery.' },
  { options: ['A. when evidence-based escalation protocols are enforced.', 'B. because retrospective reporting always captures issues.', 'C. if all participants share common performance definitions.', 'D. after seasonal adjustments are factored into baselines.', 'E. while long-term tracking is reduced to annual reviews.', 'F. once governance quality exceeds resource quantity.'], answer: 'C. if all participants share common performance definitions.' },
];

const COMPLETION_ANSWERS_ACADEMIC = [
  'shared metrics', 'review cadence', 'baseline measurement', 'governance quality',
  'accountability chains', 'escalation rules', 'matched comparisons', 'reporting templates',
  'corrective action', 'performance trends', 'root-cause analysis', 'system capability',
  'process alignment', 'delivery routines', 'risk classification', 'anomaly detection',
  'planning cycles', 'outcome verification', 'standardised reporting', 'transparent measurement',
];

const COMPLETION_ANSWERS_GENERAL = [
  'clear handover', 'written confirmation', 'reference number', 'complaints procedure',
  'cooling-off period', 'proof of purchase', 'terms and conditions', 'direct debit',
  'cancellation deadline', 'customer reference', 'valid identification', 'delivery window',
  'service agreement', 'renewal notice', 'deposit refund', 'booking confirmation',
  'waiting list', 'membership card', 'safety inspection', 'contact details',
];

const HEADING_POOLS = [
  ['Defining the implementation challenge', 'Comparative evidence from parallel programmes', 'Standardising reporting across organisations', 'Why weak starting points distort evaluation', 'Rapid escalation and anomaly management', 'Conditions necessary for lasting results', 'When surface-level data conceals deeper problems', 'Governance decisions shaping long-term outcomes'],
  ['Origins of the policy initiative', 'Lessons from multi-site trials', 'Aligning measurement definitions', 'Pitfalls of inadequate baseline data', 'Early warning systems and rapid response', 'Factors enabling sustainable progress', 'Hidden weaknesses beneath headline figures', 'Structural choices affecting programme durability'],
  ['Setting the context for reform', 'Findings from cross-institutional review', 'Common language for performance tracking', 'Risks of premature scaling from pilot data', 'Incident management and root-cause discipline', 'Building blocks for long-term reliability', 'Surface metrics versus operational reality', 'Institutional design and accountability frameworks'],
  ['Background to the current initiative', 'Evidence gathered from comparable schemes', 'Harmonising indicators across delivery partners', 'Limitations of short-term evaluation windows', 'Anomaly detection and escalation pathways', 'Securing durable improvement over time', 'The gap between reported and actual performance', 'How governance structures shape outcomes'],
  ['Framing the core challenge', 'Insights from programme-level comparisons', 'Creating shared definitions for quality metrics', 'Seasonal and novelty effects on early results', 'Timely investigation of process failures', 'Requirements for sustained system performance', 'Discrepancies between narrative and evidence', 'Leadership and accountability in programme design'],
];

const INSTITUTION_POOLS = [
  ['Policy Evaluation Office', 'Programme Quality Unit', 'Local Delivery Board', 'Audit and Standards Council', 'Operations Coordination Forum'],
  ['National Review Agency', 'Regional Planning Authority', 'Service Improvement Team', 'Independent Oversight Panel', 'Strategic Delivery Office'],
  ['Central Assessment Bureau', 'Cross-Agency Task Force', 'Quality Assurance Division', 'Field Operations Directorate', 'Impact Evaluation Committee'],
  ['Standards Compliance Unit', 'Outcome Measurement Board', 'Community Liaison Office', 'Infrastructure Planning Group', 'Research and Evidence Centre'],
  ['Performance Monitoring Council', 'Stakeholder Engagement Office', 'Risk Management Authority', 'Programme Integration Unit', 'Accountability Review Panel'],
];

/* ── Passage template pools for diverse content ── */

const ACADEMIC_OPENINGS = [
  (topic: string) => `Recent scholarly inquiry into ${topic} reveals a widening gap between policy ambition and measurable delivery outcomes across multiple jurisdictions.`,
  (topic: string) => `A comprehensive review of ${topic} demonstrates that institutional design, rather than resource allocation alone, determines whether strategic goals translate into operational reality.`,
  (topic: string) => `Interdisciplinary research on ${topic} has challenged prevailing assumptions, suggesting that systemic factors outweigh individual initiatives in driving large-scale change.`,
  (topic: string) => `Contemporary analysis of ${topic} indicates that evidence-based frameworks consistently outperform ad-hoc approaches when evaluated across multiple performance dimensions.`,
  (topic: string) => `Cross-national comparisons of ${topic} highlight the critical importance of governance quality, showing that similar investments yield vastly different results depending on institutional capacity.`,
];

const GENERAL_OPENINGS = [
  (topic: string) => `Practical guides on ${topic} consistently emphasise that preparation, clear communication, and documented records protect consumers from common pitfalls.`,
  (topic: string) => `Service reviews related to ${topic} reveal that customer satisfaction depends far more on transparent communication than on the speed of individual transactions.`,
  (topic: string) => `Community feedback on ${topic} shows that residents who take time to understand procedures and requirements before engaging tend to achieve significantly better outcomes.`,
  (topic: string) => `Consumer advice regarding ${topic} highlights the importance of comparing options, reading the fine print, and keeping written records of all communications.`,
  (topic: string) => `Local authorities handling ${topic} report that most complaints arise from misunderstandings about timelines, responsibilities, and documentation requirements.`,
];

const ACADEMIC_PARAGRAPHS = [
  (topic: string, baseline: number, improved: number) => `A multi-site evaluation recorded improvement from approximately ${baseline}% baseline reliability to nearly ${improved}% after teams introduced standardised reporting templates, fixed weekly review schedules, and explicit ownership for unresolved actions. Researchers cautioned that infrastructure upgrades alone did not account for these gains; the quality of governance frameworks remained the strongest predictor of sustained progress.`,
  (topic: string, baseline: number, improved: number) => `Longitudinal tracking across ${baseline + 5} participating institutions showed that sites adopting structured review cycles improved their target metrics by ${improved - baseline} percentage points over two years. Importantly, sites that relied primarily on financial incentives without governance reform showed only temporary gains that dissipated within months of programme completion.`,
  (topic: string, baseline: number, improved: number) => `Controlled comparison studies found that facilities implementing comprehensive accountability frameworks achieved reliability rates of ${improved}%, compared with only ${baseline}% among facilities using informal coordination methods. The researchers concluded that formalised processes created a foundation for continuous improvement that informal arrangements could not sustain.`,
];

const GENERAL_PARAGRAPHS = [
  (topic: string, baseline: number, improved: number) => `Customer satisfaction surveys showed that ratings improved from ${baseline}% to ${improved}% once service providers implemented clearer communication timelines, dedicated complaint handlers, and written confirmation at each stage of the process. Advisors noted that these changes cost relatively little to implement but produced disproportionately large improvements in user confidence.`,
  (topic: string, baseline: number, improved: number) => `A comparison of ${baseline + 3} service providers in the region found that those offering step-by-step guides and proactive status updates achieved ${improved}% customer retention, compared with just ${baseline}% for providers relying on customers to initiate contact. The key differentiator was not the service itself but the clarity of the process surrounding it.`,
  (topic: string, baseline: number, improved: number) => `Follow-up surveys revealed that users who received written confirmation of their arrangements reported satisfaction rates of ${improved}%, while those relying on verbal agreements alone reported only ${baseline}%. Consumer advisors emphasised that documentation serves as both a reference tool and a safeguard against miscommunication.`,
];

const ACADEMIC_COORDINATION = [
  (topic: string) => `Cross-agency coordination improved markedly once institutions adopted common definitions for completion, delay, and risk classification. Before this alignment, programme managers compared non-equivalent indicators and misinterpreted performance trajectories. After harmonisation, planning meetings shifted from terminological disputes to substantive decisions on corrective sequencing and resource allocation.`,
  (topic: string) => `Interoperability between research teams was significantly enhanced when a shared taxonomy for outcome measurement was introduced. Prior to this development, each participating institution used idiosyncratic definitions that made cross-site comparison unreliable. The standardisation process itself generated valuable dialogue about what constituted meaningful evidence of progress in ${topic}.`,
  (topic: string) => `Collaboration across disciplinary boundaries proved essential in advancing ${topic}. When researchers from different traditions began using aligned methodological frameworks, the rate of replicable findings increased substantially. Critics noted that premature standardisation could suppress innovative approaches, but proponents argued that a common baseline facilitated rather than constrained creative investigation.`,
];

const GENERAL_COORDINATION = [
  (topic: string) => `Communication between service providers and customers improved significantly when standardised update schedules were introduced. Before this change, customers frequently contacted helplines for basic status information, creating unnecessary workload for staff and frustration for users. The new system allowed both parties to focus on resolving genuine issues rather than chasing routine updates.`,
  (topic: string) => `Coordination between different departments handling aspects of ${topic} was streamlined after a centralised tracking system was implemented. Previously, customers had to repeat their details to multiple staff members and often received contradictory information. The integrated approach ensured that all relevant personnel could access the same up-to-date records.`,
  (topic: string) => `The introduction of clear handover procedures between stages of the ${topic} process reduced the number of complaints by a significant margin. Customers reported feeling better informed, and staff members appreciated having documented guidelines rather than relying on informal knowledge passed between colleagues.`,
];

const ACADEMIC_METHODOLOGY = [
  (signalWindow: number) => `Methodological rigour was paramount because compressed evaluation windows could overstate programmatic impact. Independent reviewers highlighted that inadequate baselines and cyclical demand fluctuations frequently distorted preliminary reporting. More robust studies employed matched comparisons, extended tracking periods, and sensitivity analyses to determine whether improvements persisted once initial novelty effects had dissipated.`,
  (signalWindow: number) => `Critical appraisal of evaluation methodologies revealed that studies lacking appropriate control conditions systematically overestimated programme effectiveness. Peer reviewers recommended that future evaluations incorporate pre-registered analysis plans, stratified sampling, and a minimum ${signalWindow}-month follow-up period to distinguish genuine impact from regression to the mean.`,
  (signalWindow: number) => `The research community increasingly recognised that premature claims of success, based on limited pilot data, undermined the credibility of the field. Methodological guidelines issued by the coordinating body stipulated that evaluations must include at least ${signalWindow} months of post-intervention monitoring, transparent reporting of null findings, and independent verification of primary outcome measures.`,
];

const GENERAL_METHODOLOGY = [
  (signalWindow: number) => `Consumer protection agencies advised that customers should allow at least ${signalWindow} working days for formal complaints to be processed before escalating to external bodies. Research showed that most issues were resolved satisfactorily when customers provided clear documentation, maintained a log of communications, and followed the prescribed complaint pathway rather than bypassing it.`,
  (signalWindow: number) => `Advisory services recommended that consumers keep records of all correspondence for a minimum of ${signalWindow} months after the completion of any service agreement. This documentation proved essential in cases where disputes arose, as verbal agreements alone were rarely sufficient to support a formal complaint or claim for compensation.`,
  (signalWindow: number) => `Independent consumer testing found that waiting periods of ${signalWindow} days before making major decisions allowed customers to compare options more effectively, read reviews from multiple sources, and avoid pressure-selling tactics. Those who followed this cooling-off approach reported significantly higher satisfaction with their eventual choices.`,
];

const ACADEMIC_ANOMALY = [
  (signalWindow: number) => `Sites that enforced anomaly investigation within ${signalWindow} hours reduced repeated process failures and improved forecast confidence substantially. Teams documented root-cause evidence before closing each incident, a practice that prevented unresolved issues from re-emerging as larger disruptions in subsequent operational cycles.`,
  (signalWindow: number) => `Rapid response protocols requiring initial assessment within ${signalWindow} hours of anomaly detection proved highly effective at containing cascade failures. Post-implementation analysis showed that the discipline of documenting findings before closing investigations created an institutional memory that progressively reduced the frequency and severity of incidents.`,
  (signalWindow: number) => `The implementation of a ${signalWindow}-hour investigation window for anomalous results transformed the culture of problem-solving within participating institutions. Rather than treating unexpected findings as inconveniences to be dismissed, teams began viewing them as diagnostic opportunities that could reveal systemic vulnerabilities requiring structural remediation.`,
];

const GENERAL_ANOMALY = [
  (signalWindow: number) => `Service providers who responded to complaints within ${signalWindow} hours achieved significantly higher resolution rates and customer retention scores. The key finding was not that speed alone mattered, but that prompt acknowledgement combined with realistic timelines for resolution demonstrated respect for the customer's situation and built trust in the process.`,
  (signalWindow: number) => `Emergency helplines operating with a ${signalWindow}-minute maximum response target found that initial contact quality was more important than response speed alone. Callers who received clear, accurate information in their first interaction were far less likely to need follow-up calls, reducing overall demand on the service while improving user satisfaction.`,
  (signalWindow: number) => `Feedback analysis showed that issues escalated within ${signalWindow} hours of first report were resolved in half the time of those left unaddressed. Customer service experts emphasised that early intervention not only reduced the cost of resolution but also prevented minor issues from developing into formal complaints or regulatory referrals.`,
];

const ACADEMIC_CONCLUSIONS = [
  (topic: string) => `The synthesis of evidence argues that ${topic} should be conceptualised as a systems-level capability rather than a discrete project. Durable improvement depends on the interplay of transparent measurement, disciplined follow-through, accountable leadership, and incentive structures aligned with verified outcomes rather than optimistic narrative reporting or short-term political visibility.`,
  (topic: string) => `In conclusion, the evidence strongly suggests that sustainable progress in ${topic} requires institutional commitments that extend well beyond initial implementation phases. Programmes that invested in governance infrastructure, evaluation capacity, and cross-stakeholder learning mechanisms demonstrated the most resilient outcomes over extended observation periods.`,
  (topic: string) => `The overarching lesson from the research literature on ${topic} is that complexity demands humility. Interventions that acknowledged uncertainty, built in adaptive mechanisms, and prioritised learning over premature claims of success consistently outperformed those that treated implementation as a linear process from design to delivery.`,
];

const GENERAL_CONCLUSIONS = [
  (topic: string) => `In summary, the guidance on ${topic} consistently shows that informed, prepared consumers who document their interactions and understand their rights achieve far better outcomes than those who proceed on assumptions alone. Taking time to research, compare, and keep records is the most effective protection against dissatisfaction and dispute.`,
  (topic: string) => `The overall advice regarding ${topic} emphasises that while most service providers operate in good faith, customers are best protected when they maintain written records, understand cancellation and complaint procedures, and are willing to escalate through official channels when informal resolution proves insufficient.`,
  (topic: string) => `Consumer experts conclude that success with ${topic} depends less on luck and more on preparation. Those who approach the process with clear expectations, documented communications, and knowledge of their rights consistently report higher satisfaction levels and fewer unresolved issues.`,
];

/* ─────────────────── QUESTION TYPES ─────────────────── */

const QUESTION_TYPES: ReadingQuestion['type'][] = [
  'matching_headings',
  'multiple_choice_single',
  'true_false_not_given',
  'summary_completion',
  'short_answer',
  'matching_information',
  'yes_no_not_given',
  'matching_features',
  'sentence_completion',
  'multiple_choice_multiple',
  'matching_sentence_endings',
  'note_table_flow_completion',
  'diagram_label_completion',
];

const hash = (value: string) => crypto.createHash('sha1').update(value).digest('hex');
const toId = () => crypto.randomBytes(12).toString('hex');

/* ─── deterministic seeded random (keeps output reproducible) ─── */
const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

const _pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];
void _pick;

/* ─── Question builder ─── */

const makeQuestion = (
  track: ReadingTrack,
  sectionId: SectionId,
  questionNumber: number,
  topic: string,
  headingOptions: string[],
  institutions: string[],
  testIndex: number,
  sectionIndex: number,
): ReadingQuestion => {
  const type = QUESTION_TYPES[(questionNumber - 1) % QUESTION_TYPES.length];
  const paragraphNumber = ((questionNumber - 1) % 6) + 1;
  void seededRng(testIndex * 1000 + sectionIndex * 100 + questionNumber);
  const base = {
    questionId: `${sectionId}_q${questionNumber}`,
    sectionId,
    type,
    prompt: `Q${questionNumber}. Answer this ${type.replace(/_/g, ' ')} item using evidence from the passage on ${topic}.`,
    explanation: 'Use exact evidence from the passage and eliminate distractors before finalizing.',
  } as ReadingQuestion;

  switch (type) {
    case 'multiple_choice_single': {
      const pool = track === 'academic' ? ACADEMIC_MC_SINGLE_PROMPTS : GENERAL_MC_SINGLE_PROMPTS;
      const variant = pool[(testIndex + questionNumber) % pool.length];
      return {
        ...base,
        prompt: variant.prompt(paragraphNumber),
        options: variant.options,
        answerSpec: { kind: 'single', value: variant.answer },
        correctAnswer: variant.answer,
      };
    }
    case 'multiple_choice_multiple': {
      const variant = MC_MULTIPLE_VARIANTS[(testIndex + sectionIndex) % MC_MULTIPLE_VARIANTS.length];
      return {
        ...base,
        prompt: variant.prompt,
        options: variant.options,
        answerSpec: { kind: 'multi', value: variant.answer },
        correctAnswer: variant.answer.join('|'),
      };
    }
    case 'true_false_not_given': {
      const variant = TFNG_VARIANTS[(testIndex + questionNumber) % TFNG_VARIANTS.length];
      return {
        ...base,
        prompt: variant.prompt(paragraphNumber),
        options: ['True', 'False', 'Not Given'],
        answerSpec: { kind: 'single', value: variant.answer },
        correctAnswer: variant.answer,
      };
    }
    case 'yes_no_not_given': {
      const variant = YNNG_VARIANTS[(testIndex + questionNumber) % YNNG_VARIANTS.length];
      return {
        ...base,
        prompt: variant.prompt,
        options: ['Yes', 'No', 'Not Given'],
        answerSpec: { kind: 'single', value: variant.answer },
        correctAnswer: variant.answer,
      };
    }
    case 'matching_headings':
      return {
        ...base,
        prompt: `Choose the best heading for paragraph ${paragraphNumber}.`,
        instructions: 'Select one heading only.',
        options: headingOptions.map((h, i) => `${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][i]}. ${h}`),
        answerSpec: {
          kind: 'single',
          value: `${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][paragraphNumber - 1]}. ${headingOptions[paragraphNumber - 1]}`,
        },
        correctAnswer: `${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][paragraphNumber - 1]}. ${headingOptions[paragraphNumber - 1]}`,
      };
    case 'matching_information':
    case 'matching_features':
      return {
        ...base,
        prompt: `Which institution is linked to the evidence discussed in paragraph ${paragraphNumber}?`,
        options: institutions.map((item, i) => `${String.fromCharCode(65 + i)}. ${item}`),
        answerSpec: {
          kind: 'single',
          value: `${String.fromCharCode(65 + (paragraphNumber % institutions.length))}. ${institutions[paragraphNumber % institutions.length]}`,
        },
        correctAnswer: `${String.fromCharCode(65 + (paragraphNumber % institutions.length))}. ${institutions[paragraphNumber % institutions.length]}`,
      };
    case 'matching_sentence_endings': {
      const variant = SENTENCE_ENDING_VARIANTS[(testIndex + sectionIndex) % SENTENCE_ENDING_VARIANTS.length];
      return {
        ...base,
        prompt: 'Choose the sentence ending that matches the writer\'s argument.',
        options: variant.options,
        answerSpec: { kind: 'single', value: variant.answer },
        correctAnswer: variant.answer,
      };
    }
    case 'sentence_completion':
    case 'summary_completion':
    case 'note_table_flow_completion':
    case 'diagram_label_completion': {
      const answers = track === 'academic' ? COMPLETION_ANSWERS_ACADEMIC : COMPLETION_ANSWERS_GENERAL;
      const answer = answers[(testIndex * 3 + sectionIndex * 7 + questionNumber) % answers.length];
      return {
        ...base,
        answerSpec: { kind: 'single', value: answer, maxWords: 3, caseSensitive: false },
        correctAnswer: answer,
      };
    }
    case 'short_answer':
    default: {
      const answers = track === 'academic' ? COMPLETION_ANSWERS_ACADEMIC : COMPLETION_ANSWERS_GENERAL;
      const answer = answers[(testIndex * 5 + sectionIndex * 11 + questionNumber * 3) % answers.length];
      return {
        ...base,
        answerSpec: { kind: 'single', value: answer, maxWords: 3 },
        correctAnswer: answer,
      };
    }
  }
};

/* ─── Section builder ─── */

const makeSection = (
  track: ReadingTrack,
  sectionId: SectionId,
  sectionIndex: number,
  globalStartQuestion: number,
  count: number,
  topic: string,
  testIndex: number,
): ReadingSection => {
  void seededRng(testIndex * 100 + sectionIndex);
  const baseline = 12 + ((testIndex + sectionIndex) % 18);
  const improved = baseline + 8 + ((testIndex * 3 + sectionIndex) % 13);
  const signalWindow = 24 + ((testIndex * 5 + sectionIndex) % 36);
  const headingPool = HEADING_POOLS[(testIndex + sectionIndex) % HEADING_POOLS.length];
  const institutionPool = INSTITUTION_POOLS[(testIndex + sectionIndex) % INSTITUTION_POOLS.length];

  const openings = track === 'academic' ? ACADEMIC_OPENINGS : GENERAL_OPENINGS;
  const paraPool = track === 'academic' ? ACADEMIC_PARAGRAPHS : GENERAL_PARAGRAPHS;
  const coordPool = track === 'academic' ? ACADEMIC_COORDINATION : GENERAL_COORDINATION;
  const methPool = track === 'academic' ? ACADEMIC_METHODOLOGY : GENERAL_METHODOLOGY;
  const anomPool = track === 'academic' ? ACADEMIC_ANOMALY : GENERAL_ANOMALY;
  const concPool = track === 'academic' ? ACADEMIC_CONCLUSIONS : GENERAL_CONCLUSIONS;

  const opening = openings[(testIndex + sectionIndex) % openings.length](topic);
  const p2 = paraPool[(testIndex * 2 + sectionIndex) % paraPool.length](topic, baseline, improved);
  const p3 = coordPool[(testIndex * 3 + sectionIndex) % coordPool.length](topic);
  const p4 = methPool[(testIndex * 4 + sectionIndex) % methPool.length](signalWindow);
  const p5 = anomPool[(testIndex * 5 + sectionIndex) % anomPool.length](signalWindow);
  const p6 = concPool[(testIndex * 6 + sectionIndex) % concPool.length](topic);

  const passageText = [
    `${opening} Comparative studies found that outcomes diverged when agencies launched similar initiatives without shared baseline metrics and escalation rules. Programmes with clear accountability chains were more likely to convert strategic goals into repeatable delivery routines.`,
    p2,
    p3,
    p4,
    p5,
    p6,
  ].join('\n\n');

  const questions = Array.from({ length: count }, (_, offset) =>
    makeQuestion(track, sectionId, globalStartQuestion + offset, topic, headingPool, institutionPool, testIndex, sectionIndex),
  );

  return {
    sectionId,
    title: `Passage ${sectionIndex + 1}`,
    passageText,
    suggestedMinutes: 20,
    questions,
  };
};

/* ─── Test payload builder ─── */

const makeTestPayload = (track: ReadingTrack, index: number) => {
  const topicList = TOPICS[track];
  const topic = topicList[index % topicList.length];
  const variant = (index % 97) + 1;
  const title = `${track.toUpperCase()} Reading V2 Test ${String(index + 1).padStart(4, '0')} - ${topic} (${variant})`;

  const sections: ReadingSection[] = [
    makeSection(track, 'p1', 0, 1, 13, topic, index),
    makeSection(track, 'p2', 1, 14, 13, topic, index),
    makeSection(track, 'p3', 2, 27, 14, topic, index),
  ];
  const flattened = sections.flatMap((s) => s.questions);

  return {
    track,
    title,
    schemaVersion: 'v2',
    qualityTier: QUALITY_TIER,
    sectionCount: 3,
    sections,
    passageTitle: sections[0].title,
    passageText: sections[0].passageText,
    suggestedTimeMinutes: 60,
    questions: flattened,
    source: 'bank',
    autoPublished: true,
    active: true,
  };
};

/* ─── DB helpers ─── */

const ensureTable = async (client: Client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "reading_tests" (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
};

const loadExistingFingerprints = async (client: Client, track: ReadingTrack) => {
  const result = await client.query(
    `SELECT data->>'title' AS title, data->>'schemaVersion' AS schema_version
     FROM reading_tests
     WHERE data->>'track' = $1
       AND COALESCE(data->>'active', 'false') = 'true'
       AND COALESCE(data->>'autoPublished', 'false') = 'true'
       AND COALESCE(data->>'qualityTier', 'legacy') = $2
       AND COALESCE(data->>'schemaVersion', 'v1') = 'v2';`,
    [track, QUALITY_TIER],
  );
  const set = new Set<string>();
  for (const row of result.rows) {
    if (row.title) {
      set.add(hash(`${track}|${row.title}|${row.schema_version || 'v2'}`));
    }
  }
  return set;
};

const insertBatch = async (
  client: Client,
  rows: Array<{ id: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }>,
) => {
  const ids = rows.map((r) => r.id);
  const payloads = rows.map((r) => JSON.stringify(r.data));
  const createdAt = rows.map((r) => r.createdAt);
  const updatedAt = rows.map((r) => r.updatedAt);
  await client.query(
    `INSERT INTO reading_tests (id, data, created_at, updated_at)
     SELECT item_id, item_data::jsonb, item_created, item_updated
     FROM UNNEST($1::text[], $2::text[], $3::timestamptz[], $4::timestamptz[])
       AS source(item_id, item_data, item_created, item_updated)
     ON CONFLICT (id) DO NOTHING;`,
    [ids, payloads, createdAt, updatedAt],
  );
};

/* ─── Seed runner ─── */

const seedTrack = async (client: Client, track: ReadingTrack) => {
  const existing = await loadExistingFingerprints(client, track);
  console.log(`[seed:reading-500] ${track} existing=${existing.size}, target=${TARGET_PER_TRACK}`);

  let produced = 0;
  let pointer = 0;
  let buffer: Array<{ id: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }> = [];

  while (produced < TARGET_PER_TRACK) {
    const payload = makeTestPayload(track, pointer);
    pointer += 1;
    const fp = hash(`${track}|${payload.title}|v2`);
    if (existing.has(fp)) continue;
    existing.add(fp);
    produced += 1;
    const now = new Date().toISOString();
    buffer.push({
      id: toId(),
      data: payload,
      createdAt: now,
      updatedAt: now,
    });
    if (buffer.length >= BATCH_SIZE || produced === TARGET_PER_TRACK) {
      if (!DRY_RUN) {
        await insertBatch(client, buffer);
      }
      console.log(`[seed:reading-500] ${track} inserted ${produced}/${TARGET_PER_TRACK}`);
      buffer = [];
    }
  }
};

const main = async () => {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL or SUPABASE_DB_URL is required.');
  }
  console.log(`[seed:reading-500] Starting: ${TARGET_PER_TRACK} per track, dryRun=${DRY_RUN}`);
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await ensureTable(client);
    for (const track of TRACKS) {
      await seedTrack(client, track);
    }
    console.log(`[seed:reading-500] done (dryRun=${DRY_RUN})`);
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error('[seed:reading-500] failed', error);
  process.exit(1);
});
