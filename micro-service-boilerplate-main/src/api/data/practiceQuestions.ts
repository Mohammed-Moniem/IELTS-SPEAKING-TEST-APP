export interface PracticeQuestionData {
  slug: string;
  question: string;
  timeLimit: number;
  tips: string[];
}

export const practiceQuestionBank: PracticeQuestionData[] = [
  {
    slug: 'hometown',
    question: "Let's talk about your hometown. Can you describe where you're from and what makes it special?",
    timeLimit: 120,
    tips: [
      'Give specific details about location and features',
      'Mention what you like most about your hometown',
      "Talk about any changes you've seen over time",
      'Keep your answer between 1-2 minutes'
    ]
  },
  {
    slug: 'education',
    question: 'Tell me about your educational background. What subjects did you enjoy most and why?',
    timeLimit: 120,
    tips: [
      'Mention your current or most recent studies',
      'Explain why certain subjects interested you',
      'Talk about your learning style or preferences',
      'Give specific examples when possible'
    ]
  },
  {
    slug: 'memorable-event',
    question:
      'Describe an important event in your life that you will never forget. You should say: What the event was, When and where it happened, Who was involved, And explain why this event was so memorable for you.',
    timeLimit: 180,
    tips: [
      'Organize your answer using the bullet points provided',
      'Speak for the full 2 minutes if possible',
      'Include specific details and personal feelings',
      'Use past tenses to describe what happened'
    ]
  },
  {
    slug: 'technology',
    question:
      'How has technology changed the way people communicate compared to the past? Do you think these changes are positive or negative?',
    timeLimit: 180,
    tips: [
      'Compare past and present communication methods',
      'Give balanced arguments for both sides',
      'Use examples to support your points',
      'Express your opinion clearly with reasons'
    ]
  },
  {
    slug: 'work-life',
    question:
      'What kind of work do you do or would you like to do in the future? What attracts you to this type of work?',
    timeLimit: 120,
    tips: [
      'Describe your current job or career goals',
      'Explain what interests you about this work',
      'Mention any skills or qualifications needed',
      'Keep it personal and genuine'
    ]
  },
  {
    slug: 'social-media',
    question:
      'Some people say social media has made people more isolated despite being more connected. What is your opinion on this?',
    timeLimit: 180,
    tips: [
      'Acknowledge both sides of the argument',
      'Use specific examples from your own experience',
      'Discuss both benefits and drawbacks',
      'Give a clear personal conclusion'
    ]
  }
];

export const getPracticeQuestion = (slug: string) => practiceQuestionBank.find(question => question.slug === slug);
