import mongoose from 'mongoose';

// Topic Schema
const topicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  part: { type: Number, required: true },
  category: { type: String, required: true },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  description: { type: String, required: true },
  questions: [{ type: String }],
  tips: [{ type: String }],
  isPremium: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Topic = mongoose.model('Topic', topicSchema, 'topics');

const newTopics = [
  {
    title: 'Technology in Society',
    slug: 'technology-in-society',
    part: 3,
    category: 'technology',
    difficulty: 'advanced',
    description: 'Discuss the impact of technology on modern life and communication.',
    questions: [
      'How has technology changed the way people communicate?',
      'What are the advantages and disadvantages of social media?',
      'Do you think people rely too much on technology today?'
    ],
    tips: [
      'Provide specific examples from your experience',
      'Discuss both positive and negative aspects',
      'Consider different age groups and their relationship with technology'
    ],
    isPremium: true,
    isActive: true
  },
  {
    title: 'Travel and Tourism',
    slug: 'travel-and-tourism',
    part: 2,
    category: 'travel',
    difficulty: 'intermediate',
    description: 'Describe a memorable journey or place you have visited.',
    questions: [
      'Describe a place you traveled to that left a strong impression on you',
      'What made this place special?',
      'Would you recommend this place to others? Why or why not?'
    ],
    tips: [
      'Use descriptive language to paint a picture',
      'Explain your feelings and emotions during the trip',
      'Provide details about what made it memorable'
    ],
    isPremium: false,
    isActive: true
  },
  {
    title: 'Health and Fitness',
    slug: 'health-and-fitness',
    part: 1,
    category: 'lifestyle',
    difficulty: 'beginner',
    description: 'Talk about your health habits, exercise routine, and lifestyle choices.',
    questions: [
      'Do you exercise regularly? What kind of activities do you do?',
      'How do you maintain a healthy lifestyle?',
      'What changes would you like to make to improve your health?'
    ],
    tips: [
      'Be honest about your current habits',
      'Mention specific activities or routines',
      'Discuss both physical and mental health'
    ],
    isPremium: false,
    isActive: true
  },
  {
    title: 'Environmental Issues',
    slug: 'environmental-issues',
    part: 3,
    category: 'environment',
    difficulty: 'advanced',
    description: 'Analyze environmental challenges and discuss potential solutions.',
    questions: [
      'What are the most serious environmental problems facing the world today?',
      'What can individuals do to help protect the environment?',
      'Should governments impose stricter environmental regulations?'
    ],
    tips: [
      'Use formal language and complex sentences',
      'Present different perspectives on the issues',
      'Support your opinions with logical reasoning'
    ],
    isPremium: true,
    isActive: true
  }
];

async function addTopics() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/ielts-speaking', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    } as any);
    console.log('✅ Connected to MongoDB');

    // Check existing topics count
    const existingCount = await Topic.countDocuments();
    console.log(`📊 Existing topics: ${existingCount}`);

    // Insert new topics
    const inserted = await Topic.insertMany(newTopics);
    console.log(`✅ Added ${inserted.length} new topics`);

    // Show updated count
    const newCount = await Topic.countDocuments();
    console.log(`📚 Total topics now: ${newCount}`);

    // List all topics
    const allTopics = await Topic.find().select('title part difficulty isPremium');
    console.log('\n📋 All topics:');
    allTopics.forEach((topic, index) => {
      console.log(
        `${index + 1}. ${topic.title} (Part ${topic.part}, ${topic.difficulty}${topic.isPremium ? ', Premium' : ''})`
      );
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addTopics();
