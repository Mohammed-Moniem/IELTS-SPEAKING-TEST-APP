import OpenAI from 'openai';
import { Service } from 'typedi';
import { Logger } from '../../lib/logger';

interface GeneratedTopic {
  question: string;
  category: 'part1' | 'part2' | 'part3';
  difficulty: 'easy' | 'medium' | 'hard';
  keywords: string[];
  followUpQuestions?: string[];
  cueCard?: {
    mainTopic: string;
    bulletPoints: string[];
    timeToSpeak: number;
    preparationTime: number;
  };
}

interface TopicGenerationOptions {
  category: 'part1' | 'part2' | 'part3';
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  excludeKeywords?: string[];
}

@Service()
export class TopicGenerationService {
  private openai: OpenAI;
  private logger = new Logger(__filename);

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL
    });

    this.logger.info('TopicGenerationService initialized');
  }

  /**
   * Generate IELTS speaking topics using AI
   */
  async generateTopics(options: TopicGenerationOptions): Promise<GeneratedTopic[]> {
    try {
      const { category, count = 5, difficulty = 'medium', excludeKeywords = [] } = options;

      this.logger.info(`Generating ${count} topics for ${category}, difficulty: ${difficulty}`);

      const systemPrompt = this.getSystemPrompt(category);
      const userPrompt = this.getUserPrompt(category, count, difficulty, excludeKeywords);

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9, // Higher creativity for diverse topics
        max_tokens: 2000
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      // Clean the response - remove markdown code blocks if present
      let cleanedContent = responseContent.trim();

      // Remove ```json and ``` markers
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      cleanedContent = cleanedContent.trim();

      // Parse JSON response
      let topics;
      try {
        topics = JSON.parse(cleanedContent);
      } catch (parseError: any) {
        this.logger.error('JSON parsing failed:', {
          error: parseError.message,
          rawContent: responseContent.substring(0, 200), // Log first 200 chars
          cleanedContent: cleanedContent.substring(0, 200)
        });
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      if (!Array.isArray(topics)) {
        throw new Error('AI response is not an array of topics');
      }

      this.logger.info(`Generated ${topics.length} topics successfully`);
      return topics;
    } catch (error: any) {
      this.logger.error('Topic generation error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      throw new Error(`Failed to generate topics: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate a single random topic
   */
  async generateRandomTopic(
    category: 'part1' | 'part2' | 'part3',
    difficulty?: 'easy' | 'medium' | 'hard'
  ): Promise<GeneratedTopic> {
    const topics = await this.generateTopics({ category, count: 1, difficulty });
    return topics[0];
  }

  /**
   * System prompts for different IELTS parts
   */
  private getSystemPrompt(category: 'part1' | 'part2' | 'part3'): string {
    const basePr = `You are an expert IELTS examiner and question designer with 15+ years of experience. 
Generate authentic, high-quality IELTS Speaking Test questions that match official Cambridge IELTS standards.

Your questions must be:
- Natural and conversational
- Appropriate for the test part
- Culturally neutral (suitable for all countries)
- Varied in topic (avoid repetition)
- Aligned with real IELTS question patterns

Always return valid JSON array format.`;

    switch (category) {
      case 'part1':
        return `${basePr}

PART 1 SPECIFICATIONS:
- Focus: Personal information, daily life, familiar topics
- Duration: 4-5 minutes
- Question types: General questions about you, your life, preferences
- Topics: Home, family, work/study, hobbies, daily routine, food, technology, etc.
- Style: Simple, direct questions
- Example: "Do you work or are you a student?", "What do you like to do in your free time?"`;

      case 'part2':
        return `${basePr}

PART 2 SPECIFICATIONS:
- Focus: Individual long turn (cue card)
- Duration: 3-4 minutes (1 min prep + 2 min speech + 1 min follow-up)
- Format: Cue card with main topic and 3-4 bullet points
- Topics: Describe a person, place, object, experience, or event
- Bullet points: Guide the candidate on what to include
- Style: "Describe a...", "Talk about a time when..."
- Must include: preparation time (60 seconds), speaking time (2 minutes)
- Example topic: "Describe a place you visited that made a strong impression on you"
  - Bullet points: Where it was, When you visited, What you did there, Why it was memorable`;

      case 'part3':
        return `${basePr}

PART 3 SPECIFICATIONS:
- Focus: Abstract discussion related to Part 2 topic
- Duration: 4-5 minutes
- Question types: Opinion, speculation, comparison, analysis
- Style: More complex, thought-provoking questions
- Topics: Society, trends, future predictions, comparisons
- Example: "How do you think technology will change education in the future?", "What are the advantages and disadvantages of living in a big city?"`;

      default:
        return basePr;
    }
  }

  /**
   * User prompts for topic generation
   */
  private getUserPrompt(
    category: 'part1' | 'part2' | 'part3',
    count: number,
    difficulty: string,
    excludeKeywords: string[]
  ): string {
    const excludeNote = excludeKeywords.length > 0 ? `\n- AVOID topics related to: ${excludeKeywords.join(', ')}` : '';

    switch (category) {
      case 'part1':
        return `Generate ${count} unique IELTS Speaking Part 1 questions.

Requirements:
- Difficulty level: ${difficulty}
- Diverse topics (family, work, hobbies, technology, food, travel, sports, etc.)
- Natural, conversational questions
- Appropriate for testing general communication${excludeNote}

Return JSON array format:
[
  {
    "question": "What do you do in your free time?",
    "category": "part1",
    "difficulty": "${difficulty}",
    "keywords": ["leisure", "hobbies", "activities"],
    "followUpQuestions": [
      "How often do you do this activity?",
      "Do you prefer indoor or outdoor activities?"
    ]
  }
]`;

      case 'part2':
        return `Generate ${count} unique IELTS Speaking Part 2 cue cards.

Requirements:
- Difficulty level: ${difficulty}
- Varied topics (people, places, experiences, objects, events)
- Include 3-4 guiding bullet points
- Specify prep time (60s) and speaking time (120s)${excludeNote}

Return JSON array format:
[
  {
    "question": "Describe a memorable journey you have taken",
    "category": "part2",
    "difficulty": "${difficulty}",
    "keywords": ["travel", "journey", "experience"],
    "cueCard": {
      "mainTopic": "Describe a memorable journey you have taken",
      "bulletPoints": [
        "Where you went",
        "Who you went with",
        "What you did during the journey",
        "Why it was memorable"
      ],
      "timeToSpeak": 120,
      "preparationTime": 60
    }
  }
]`;

      case 'part3':
        return `Generate ${count} unique IELTS Speaking Part 3 discussion questions.

Requirements:
- Difficulty level: ${difficulty}
- Abstract, thought-provoking questions
- Cover social issues, trends, comparisons, predictions
- Require analysis and opinion${excludeNote}

Return JSON array format:
[
  {
    "question": "How do you think social media has changed the way people communicate?",
    "category": "part3",
    "difficulty": "${difficulty}",
    "keywords": ["social media", "communication", "technology", "society"],
    "followUpQuestions": [
      "Do you think these changes are positive or negative?",
      "How might communication evolve in the next 10 years?"
    ]
  }
]`;

      default:
        return '';
    }
  }

  /**
   * Validate generated topic
   */
  private validateTopic(topic: GeneratedTopic): boolean {
    if (!topic.question || topic.question.length < 10) {
      return false;
    }

    if (!['part1', 'part2', 'part3'].includes(topic.category)) {
      return false;
    }

    if (!['easy', 'medium', 'hard'].includes(topic.difficulty)) {
      return false;
    }

    if (topic.category === 'part2' && !topic.cueCard) {
      return false;
    }

    return true;
  }

  /**
   * Get common IELTS topics by category
   */
  getCommonTopics(category: 'part1' | 'part2' | 'part3'): string[] {
    const topics = {
      part1: [
        'Home and accommodation',
        'Work and studies',
        'Hobbies and interests',
        'Daily routine',
        'Food and cooking',
        'Technology and internet',
        'Sports and exercise',
        'Travel and holidays',
        'Friends and family',
        'Music and entertainment',
        'Shopping',
        'Weather and seasons',
        'Transportation',
        'Reading and books',
        'Art and culture'
      ],
      part2: [
        'A person you admire',
        'A place you visited',
        'An important event',
        'A memorable experience',
        'A useful skill',
        'A book or movie',
        'A gift you received',
        'A time you helped someone',
        'A childhood memory',
        'A goal you achieved',
        'A piece of advice',
        'A traditional celebration',
        'An interesting conversation',
        'A technological device',
        'A challenging situation'
      ],
      part3: [
        'Education and learning',
        'Work and career',
        'Technology impact',
        'Environmental issues',
        'Social changes',
        'Cultural differences',
        'Economic development',
        'Health and lifestyle',
        'Media and advertising',
        'Government and politics',
        'Globalization',
        'Urban vs rural life',
        'Tradition vs modernity',
        'Youth and elderly',
        'Success and failure'
      ]
    };

    return topics[category];
  }
}
