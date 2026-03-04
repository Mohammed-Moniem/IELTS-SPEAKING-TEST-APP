#!/usr/bin/env node
/**
 * Generate 200 IELTS Vocabulary topic definitions as a JSON file.
 * Each topic contains 32 vocabulary items (8 per band), collocations, tips, etc.
 * Output: /tmp/vocab-topics.json
 *
 * Usage: node scripts/generate-vocab-topics.js
 */

const fs = require('fs');

// ─── SPEAKING topics (50) ───────────────────────────────────────────
const speakingTopics = [
  { tag: 'Family & Relationships', words: {
    b56: [['relative','n','a member of your family','I have many relatives living in the same city.'],['sibling','n','a brother or sister','I have two siblings, an older brother and a younger sister.'],['upbringing','n','how a child is raised','My upbringing was quite traditional.'],['close-knit','adj','having strong bonds','We are a very close-knit family.'],['look after','phr','to take care of someone','My grandmother looks after the children.'],['get along with','phr','to have a good relationship','I get along with my cousins really well.'],['supportive','adj','giving help and encouragement','My parents have always been supportive.'],['generation','n','people born around the same time','Three generations live under our roof.']],
    b67: [['nuclear family','n','parents and children only','The nuclear family is the most common household type.'],['extended family','n','relatives beyond parents and children','Our extended family gathers every holiday.'],['bond','n','a strong connection between people','The bond between my mother and me is unbreakable.'],['breadwinner','n','the person who earns money for the family','My father is the main breadwinner.'],['nurture','v','to care for and encourage growth','My parents nurtured my love of music.'],['household','n','people living together in one home','Our household includes five people.'],['reunion','n','a gathering of family or friends','We hold a family reunion every summer.'],['overprotective','adj','too caring in a controlling way','Some parents can be overprotective.']],
    b78: [['unconditional','adj','without limits or conditions','A parent\'s love is often unconditional.'],['formative years','phr','the period when character develops','My formative years were spent in a village.'],['instil values','phr','to teach principles gradually','My parents instilled honesty in us.'],['generation gap','phr','differences between age groups','Technology has widened the generation gap.'],['patriarch','n','male head of a family','My grandfather was the family patriarch.'],['dysfunctional','adj','not operating in a healthy way','Financial stress can make families dysfunctional.'],['reconcile','v','to restore a friendly relationship','My brothers eventually reconciled.'],['filial piety','phr','respect and duty towards parents','Filial piety is important in East Asian cultures.']],
    b89: [['indelible bond','phr','a permanent unforgettable connection','The indelible bond with my sister transcends distance.'],['intergenerational','adj','involving multiple generations','Intergenerational dialogue bridges cultural divides.'],['matrilineal','adj','descent through the mother','Some societies follow matrilineal traditions.'],['conjugal','adj','relating to marriage','Conjugal harmony requires mutual respect.'],['estrangement','n','being alienated from someone','Family estrangement is more common than people think.'],['kinship','n','blood or social relationship','A sense of kinship connects our community.'],['primogeniture','n','right of firstborn to inherit','Primogeniture shaped inheritance laws for centuries.'],['symbiotic relationship','phr','mutually beneficial connection','My parents have a symbiotic relationship built on trust.']],
    colls: [['raise a family','They moved to the suburbs to raise a family.'],['family ties','Strong family ties help people cope with hardship.'],['run in the family','Musical talent seems to run in the family.'],['start a family','They plan to start a family next year.'],['family gathering','We have a family gathering every New Year.']],
    mistakes: ['Using "parents" when you mean "relatives."','Saying "my family is four people" instead of "there are four people in my family."','Confusing "sibling" with "cousin."','Using overly formal words in casual speaking.'],
    tips: ['Prepare a short anecdote about a family member for Part 2.','Use a range of relationship vocabulary beyond mother and father.','Practise describing family traditions to build fluency.','Record yourself talking about your family for two minutes.'],
    faq: ['How detailed should I be when talking about my family?','Give enough detail to show vocabulary range but stay relevant. Mention specific members, describe relationships, and include a short story.']
  }},
  { tag: 'Work & Career', words: {
    b56: [['colleague','n','a person you work with','I have lunch with my colleagues every day.'],['salary','n','money paid for work monthly','The salary for this position is competitive.'],['full-time','adj','working standard hours','I have a full-time job at a marketing firm.'],['apply for','phr','to formally request a job','I applied for a position at a tech company.'],['experience','n','knowledge from doing something','I have three years of experience in sales.'],['deadline','n','latest time to finish something','We have a tight deadline for this project.'],['promotion','n','advancement to a higher position','She received a promotion after two years.'],['shift','n','a scheduled period of work','I work the morning shift.']],
    b67: [['rewarding','adj','giving satisfaction','Teaching is a very rewarding profession.'],['demanding','adj','requiring much effort','Nursing is a physically demanding career.'],['career path','phr','progression of jobs in a field','She followed a traditional career path in law.'],['work-life balance','phr','equal time for job and personal life','Maintaining work-life balance is essential.'],['freelance','adj','self-employed for various clients','Many designers work freelance.'],['redundancy','n','losing a job because it is no longer needed','Factory closures led to widespread redundancy.'],['commute','v','to travel regularly to work','I commute for about an hour each morning.'],['perk','n','an extra benefit from a job','Free gym membership is a nice perk.']],
    b78: [['vocational','adj','relating to skills for a specific job','Vocational training leads to well-paid trades.'],['remuneration','n','payment for work or services','The remuneration package includes health insurance.'],['entrepreneurial','adj','relating to starting businesses','She has a strong entrepreneurial mindset.'],['white-collar','adj','relating to office work','White-collar workers often face high stress.'],['burnout','n','exhaustion from prolonged stress','Healthcare workers often suffer from burnout.'],['sabbatical','n','extended leave from work','He took a sabbatical to write a book.'],['meritocracy','n','system based on ability','A true meritocracy rewards hard work.'],['outsource','v','to hire an external company for tasks','Many firms outsource their IT departments.']],
    b89: [['portfolio career','phr','a career with multiple income streams','More people choose a portfolio career for flexibility.'],['glass ceiling','phr','invisible barrier to advancement','Women still face a glass ceiling in many industries.'],['golden handshake','phr','generous payment on leaving a company','The CEO received a golden handshake.'],['gig economy','phr','labour market of short-term contracts','The gig economy has transformed how people work.'],['occupational hazard','phr','a risk associated with a job','Stress is an occupational hazard of finance.'],['moonlighting','n','having a second job secretly','Moonlighting is common among underpaid workers.'],['headhunted','adj','recruited for a senior position','She was headhunted by a rival firm.'],['sinecure','n','a position with pay but little work','The role turned out to be a sinecure.']],
    colls: [['land a job','He finally landed a job in finance.'],['climb the ladder','She is determined to climb the corporate ladder.'],['job satisfaction','Job satisfaction matters more than salary to many.'],['make a living','It is hard to make a living as an artist.'],['hand in your notice','He handed in his notice last week.']],
    mistakes: ['Saying "I have a good work" instead of "I have a good job."','Using salary and wage interchangeably.','Saying "I am working since 2019" instead of "I have been working since 2019."','Confusing employer with employee.'],
    tips: ['Prepare vocabulary for both positive and negative aspects of work.','Use specific job titles rather than vague terms.','Practise future career plans using would, hope to, aim to.','Learn phrasal verbs: take on, carry out, deal with, step down.'],
    faq: ['What if I do not have a job?','Talk about studies, part-time work, volunteering, or your ideal future job. The examiner tests language, not employment status.']
  }},
  { tag: 'Education & Learning', words: {
    b56: [['subject','n','an area of study','My favourite subject at school was history.'],['homework','n','tasks assigned for home study','I spend about an hour on homework every day.'],['graduate','v','to complete a degree','I graduated from university in 2022.'],['exam','n','a formal test','I have three exams next week.'],['classmate','n','someone in your class','My classmate helped me with the assignment.'],['teacher','n','a person who teaches','My English teacher was very encouraging.'],['revise','v','to study material again','I need to revise for my exam tomorrow.'],['attend','v','to be present at','I attend lectures every weekday morning.']],
    b67: [['curriculum','n','the set of courses in a school','The national curriculum includes science and maths.'],['tuition','n','teaching or the fee for it','University tuition has risen sharply.'],['scholarship','n','financial aid for study','She won a scholarship to study abroad.'],['discipline','n','a field of study or self-control','History is my main discipline.'],['semester','n','a half-year academic term','I took five courses this semester.'],['assignment','n','a piece of academic work','The assignment is due next Friday.'],['lecture','n','a talk to a large group of students','The professor gave a fascinating lecture.'],['campus','n','the grounds of a university','I spend most of my day on campus.']],
    b78: [['pedagogy','n','the method and practice of teaching','Modern pedagogy emphasises active learning.'],['dissertation','n','a long essay for a degree','I am writing my dissertation on climate policy.'],['vocational','adj','relating to practical job skills','Vocational education prepares students for trades.'],['holistic','adj','considering the whole person','A holistic approach to education includes mental health.'],['rote learning','phr','memorisation without understanding','Rote learning is criticised for limiting creativity.'],['autonomous learner','phr','someone who studies independently','University expects you to be an autonomous learner.'],['critical thinking','phr','analysing facts to form a judgement','Critical thinking is a key academic skill.'],['extracurricular','adj','outside the normal curriculum','Extracurricular activities build teamwork skills.']],
    b89: [['autodidact','n','a self-taught person','Many great thinkers were autodidacts.'],['pedagogical','adj','relating to teaching methods','The pedagogical approach varies across countries.'],['meritocratic','adj','based on ability and talent','Education should be meritocratic, not privilege-based.'],['epistemic','adj','relating to knowledge','Epistemic curiosity drives lifelong learning.'],['andragogy','n','the method of teaching adults','Andragogy differs from traditional child-focused teaching.'],['Socratic method','phr','learning through questioning','The Socratic method encourages deep critical thought.'],['didactic','adj','intended to teach or instruct','His lectures were highly didactic in style.'],['cognitive load','phr','mental effort used in learning','Reducing cognitive load helps students retain information.']],
    colls: [['pursue a degree','She decided to pursue a degree in engineering.'],['drop out of','He dropped out of university in his second year.'],['enrol in','I enrolled in an online course last month.'],['further education','Further education opens doors to better careers.'],['steep learning curve','The new software had a steep learning curve.']],
    mistakes: ['Confusing "study" and "learn" — study is the process, learn is the result.','Saying "I am interesting in" instead of "I am interested in."','Using "make an exam" instead of "take an exam."','Confusing "teach" and "learn."'],
    tips: ['Discuss both advantages and disadvantages of education systems.','Use specific examples from your own educational experience.','Practise comparing education in different countries.','Learn vocabulary for both formal and informal education.'],
    faq: ['Should I talk about my own education system or education in general?','You can do both. Start with your own experience and then broaden to general observations. This shows range and the ability to discuss abstract ideas.']
  }},
  { tag: 'Hometown & City Life', words: {
    b56: [['neighbourhood','n','the area where you live','My neighbourhood is very peaceful.'],['crowded','adj','full of people','The city centre is always crowded.'],['convenient','adj','easy to access or use','Living near the station is very convenient.'],['suburb','n','a residential area outside the city','I grew up in a quiet suburb.'],['landmark','n','a well-known building or place','The clock tower is a famous landmark.'],['population','n','the number of people in a place','The city has a population of two million.'],['local','adj','relating to a particular area','I shop at the local market every weekend.'],['develop','v','to grow or change over time','The area has developed rapidly in recent years.']],
    b67: [['cosmopolitan','adj','diverse and worldly','London is a cosmopolitan city.'],['infrastructure','n','basic systems like roads and power','The city has excellent infrastructure.'],['commuter','n','someone who travels to work daily','Commuters face traffic jams every morning.'],['outskirts','n','the outer edges of a town','We live on the outskirts of the city.'],['renovate','v','to restore a building','They renovated the old theatre beautifully.'],['residential','adj','used for housing','This is a quiet residential area.'],['heritage','n','valued traditions from the past','The city has a rich cultural heritage.'],['urbanisation','n','the growth of cities','Urbanisation has transformed the landscape.']],
    b78: [['gentrification','n','renovation of areas attracting wealthier residents','Gentrification has pushed up property prices.'],['metropolitan','adj','relating to a large city','The metropolitan area spans several districts.'],['sprawl','n','uncontrolled expansion of urban areas','Urban sprawl is a major planning concern.'],['pedestrianised','adj','closed to traffic for walking','The city centre is now fully pedestrianised.'],['congestion','n','overcrowding causing slow movement','Traffic congestion costs the economy billions.'],['amenities','n','useful features of a place','The neighbourhood lacks basic amenities.'],['regeneration','n','renewal of a run-down area','The dock area has undergone major regeneration.'],['quaint','adj','attractively old-fashioned','The village is quaint with cobbled streets.']],
    b89: [['urban enclave','phr','a distinct area within a city','The arts district is a thriving urban enclave.'],['hinterland','n','the area beyond a city','The rural hinterland supplies food to the city.'],['conurbation','n','several cities merged into one area','The conurbation stretches for fifty kilometres.'],['brownfield site','phr','previously developed land','The new park was built on a brownfield site.'],['civic pride','phr','pride in one\'s city','Civic pride has grown since the renovation.'],['dormitory town','phr','a town whose residents work elsewhere','It has become a dormitory town for London.'],['urban blight','phr','deterioration of city areas','Urban blight is evident in abandoned buildings.'],['mixed-use development','phr','combining residential and commercial space','Mixed-use developments are increasingly popular.']],
    colls: [['bustling city','I love living in a bustling city.'],['thriving community','We are part of a thriving community.'],['run-down area','The run-down area is being regenerated.'],['urban landscape','The urban landscape has changed dramatically.'],['sense of belonging','Living here gives me a sense of belonging.']],
    mistakes: ['Saying "my hometown is very good" — be more specific about why.','Confusing "suburb" with "slum."','Using "there has" instead of "there are" for plural nouns.','Saying "it is located in the north of" without the article.'],
    tips: ['Describe what makes your hometown unique compared to other places.','Prepare vocabulary for discussing changes over time.','Use before-and-after comparisons for your hometown.','Practise map vocabulary in case of Part 2 tasks.'],
    faq: ['What if my hometown is small and boring?','You can still describe its charm, traditions, or natural surroundings. You can also discuss what you would change or how it compares to larger cities. The key is showing language ability.']
  }},
  { tag: 'Travel & Tourism', words: {
    b56: [['destination','n','a place you travel to','Paris is a popular travel destination.'],['sightseeing','n','visiting places of interest','We spent the day sightseeing in Rome.'],['souvenir','n','an item bought to remember a trip','I bought a souvenir for my mother.'],['accommodation','n','a place to stay','We booked accommodation near the beach.'],['tourist','n','a person visiting a place for pleasure','The city attracts millions of tourists.'],['flight','n','a journey by air','The flight to London takes about eight hours.'],['luggage','n','bags and suitcases for travelling','My luggage was lost at the airport.'],['booking','n','a reservation','I made a hotel booking online.']],
    b67: [['itinerary','n','a planned route or schedule','Our itinerary includes five cities in two weeks.'],['off the beaten track','phr','in an unusual or remote place','I prefer travelling off the beaten track.'],['package holiday','phr','a holiday with flights and hotel included','Many families prefer package holidays.'],['hospitality','n','friendly treatment of guests','The hospitality in Japan is exceptional.'],['backpacker','n','a budget traveller with a rucksack','Backpackers often stay in hostels.'],['excursion','n','a short trip for pleasure','We went on a boat excursion around the island.'],['jet lag','n','tiredness from crossing time zones','I suffered terrible jet lag after the flight.'],['scenic','adj','having beautiful natural views','We drove along a scenic coastal road.']],
    b78: [['ecotourism','n','responsible travel to natural areas','Ecotourism supports conservation efforts.'],['cultural immersion','phr','deeply experiencing another culture','Cultural immersion is the best way to learn a language.'],['sustainable tourism','phr','travel that minimises environmental impact','Sustainable tourism is becoming a priority.'],['pilgrimage','n','a journey to a sacred place','Thousands make the pilgrimage each year.'],['itinerant','adj','travelling from place to place','He lived an itinerant lifestyle for years.'],['wanderlust','n','a strong desire to travel','Wanderlust runs in my family.'],['heritage site','phr','a place of historical importance','The temple is a UNESCO World Heritage Site.'],['overtourism','n','excessive tourism damaging a destination','Venice suffers from overtourism every summer.']],
    b89: [['peripatetic','adj','travelling from place to place for work','Her peripatetic career took her across continents.'],['sojourn','n','a temporary stay','We enjoyed a pleasant sojourn in the countryside.'],['diaspora tourism','phr','visiting ancestral homelands','Diaspora tourism connects people with their roots.'],['dark tourism','phr','visiting sites of tragedy or death','Dark tourism raises ethical questions.'],['bleisure','n','combining business and leisure travel','Bleisure trips are increasingly popular among professionals.'],['voluntourism','n','volunteering while on holiday','Voluntourism can benefit local communities if done well.'],['bucket list','phr','a list of experiences to have before dying','Visiting Machu Picchu is on my bucket list.'],['globetrotter','n','a person who travels widely','She is a seasoned globetrotter.']],
    colls: [['broaden your horizons','Travel broadens your horizons enormously.'],['travel extensively','She has travelled extensively in Southeast Asia.'],['off-peak season','Hotels are cheaper during the off-peak season.'],['long-haul flight','I do not enjoy long-haul flights.'],['once-in-a-lifetime experience','Seeing the Northern Lights was a once-in-a-lifetime experience.']],
    mistakes: ['Saying "I went to travel" instead of "I went travelling" or "I travelled."','Confusing "trip," "travel," and "journey."','Using "funny" instead of "fun" to describe a holiday.','Saying "I have been to there" instead of "I have been there."'],
    tips: ['Prepare stories about memorable trips for Part 2 cue cards.','Use sequencing words when describing a journey.','Compare different types of travel: solo, group, adventure, luxury.','Practise describing places with sensory details.'],
    faq: ['What if I have not travelled much?','You can talk about places you want to visit, trips you have taken within your country, or even virtual tours. The examiner is testing your language, not your passport stamps.']
  }},
];

// Remaining 45 speaking topics — compact form
const speakingRest = [
  'Food & Cooking','Sports & Fitness','Technology & Gadgets','Music & Entertainment','Art & Creativity',
  'Weather & Seasons','Shopping & Consumer Habits','Health & Wellbeing','Environment & Nature','Media & News',
  'Animals & Pets','Festivals & Celebrations','History & Heritage','Books & Reading','Movies & Television',
  'Fashion & Clothing','Transport & Commuting','Hobbies & Leisure','Friendship & Social Life','Daily Routine & Habits',
  'Childhood Memories','Future Plans & Ambitions','Money & Finance','Culture & Traditions','Language & Communication',
  'Photography & Visual Arts','Gardens & Outdoor Spaces','Volunteering & Community','Sleep & Relaxation','Patience & Waiting',
  'Creativity & Innovation','Celebrations & Gifts','Noise & Quiet Places','Celebrities & Role Models','Cooking & Kitchen Skills',
  'Teamwork & Collaboration','Law & Rules','Advertising & Marketing','Colours & Preferences','Neighbours & Community Life',
  'Water & Rivers','Maps & Directions','Public Transport','Clothes & Style','Emotions & Feelings'
];

// ─── WRITING topics (50) ────────────────────────────────────────────
const writingFull = [
  'Education Systems','Technology Impact','Environment & Pollution','Healthcare & Medicine','Crime & Punishment',
  'Government & Policy','Media & Journalism','Globalisation','Cultural Heritage','Housing & Architecture',
  'Transport Infrastructure','Tourism Development','Employment & Labour','Gender Equality','Children & Development',
  'Ageing Population','Poverty & Inequality','Immigration & Migration','Scientific Research','Space Exploration',
  'Sports & Competition','Food Security','Language Preservation','Arts Funding','Animal Welfare',
  'Urbanisation','Happiness & Life Quality','Digital Communication','Noise & Air Pollution','Water & Energy Resources',
  'Economic Development','International Trade','Social Media Influence','Consumer Culture','Fashion Industry',
  'Music & Society','Film & Cultural Impact','Literature & Education','Ethics & Morality','War & Peace',
  'Democracy & Governance','Sustainable Development','Charity & Aid','Community Service','Family Structure',
  'Marriage & Relationships','Success & Achievement','Mental Health','Automation & AI','Climate Change Solutions'
];

// ─── READING topics (50) ────────────────────────────────────────────
const readingFull = [
  'Biology & Life Sciences','History & Civilisation','Psychology & Behaviour','Economics & Business','Environmental Science',
  'Computer Science & IT','Education Research','Public Health','Archaeology & Antiquities','Marine Biology',
  'Sociology & Society','Linguistics & Language','Architecture & Design','Agriculture & Farming','Geography & Landscapes',
  'Anthropology & Culture','Astronomy & Space','Chemistry & Materials','Physics & Energy','Neuroscience & Brain',
  'Genetics & DNA','Ecology & Ecosystems','Urban Planning & Cities','Renewable Energy','Climate Science',
  'Conservation & Wildlife','Human Migration','Demographics & Population','Philosophy & Ideas','Ethics & Bioethics',
  'World Literature','Art History & Movements','Music & Acoustics','Political Science','International Law',
  'Medical Research','Engineering & Innovation','Artificial Intelligence','Mathematics & Statistics','Nutrition Science',
  'Botany & Plant Science','Zoology & Animal Behaviour','Oceanography & Seas','Meteorology & Weather','Geology & Earth Science',
  'Palaeontology & Fossils','Transport & Logistics','Communication & Media Studies','Sport Science & Performance','Water Resources & Management'
];

// ─── LISTENING topics (50) ──────────────────────────────────────────
const listeningFull = [
  'Campus & University Life','Library & Study Facilities','Student Accommodation','Banking & Finance','Healthcare & Clinics',
  'Travel Booking & Reservations','Job Interviews & Applications','Orientation & Induction','Museums & Galleries','Sports & Recreation Centres',
  'Restaurants & Dining','Shopping & Returns','Insurance & Claims','Driving & Vehicle Registration','Course Registration & Enrolment',
  'Moving & Relocation','Biology Lectures','History Lectures','Psychology Lectures','Geography & Environment Lectures',
  'Sociology Lectures','Seminar Discussions','Tutorial Conversations','Student Support Services','Career Guidance & Counselling',
  'Research Methods & Projects','Laboratory Safety','Environmental Field Studies','Field Trips & Excursions','Academic Conferences',
  'Workshop & Training Sessions','Presentation Skills','Study Skills & Techniques','Time Management','Note-Taking Strategies',
  'Essay & Report Writing','Exam Preparation & Revision','Group Projects & Teamwork','Volunteer & Charity Programmes','Cultural Events & Festivals',
  'Community Services','Fitness & Gym Programmes','Nutrition & Diet Advice','Language Exchange & Practice','Technology & IT Support',
  'Photography & Media','Art Classes & Workshops','Music Lessons & Performance','Dance & Movement Classes','Cooking Classes & Food Safety'
];

/* ─── VOCABULARY POOLS ───────────────────────────────────────────────
   For topics without hand-crafted data, we generate from curated pools.
   Each pool maps a topic theme to band-level vocabulary.
   ──────────────────────────────────────────────────────────────────── */

// Master vocabulary pools keyed by topic area
const vocabPools = {
  // ── SPEAKING POOLS ──
  'Food & Cooking': {
    b56: [['delicious','adj','very tasty','The food at the restaurant was delicious.'],['recipe','n','instructions for cooking','I followed my grandmother\'s recipe.'],['ingredient','n','a component of a dish','Fresh ingredients make a big difference.'],['spicy','adj','having a strong hot flavour','I love spicy food like Thai curries.'],['homemade','adj','made at home, not bought','Homemade bread tastes much better.'],['portion','n','an amount of food for one person','The portions at that restaurant are huge.'],['takeaway','n','food bought to eat elsewhere','We ordered a takeaway last night.'],['snack','n','a small amount of food between meals','I usually have a snack around four o\'clock.']],
    b67: [['nutritious','adj','containing nutrients good for health','Fruits and vegetables are very nutritious.'],['cuisine','n','a style of cooking','Japanese cuisine is known for its freshness.'],['appetising','adj','stimulating the appetite','The dish looked incredibly appetising.'],['dietary','adj','relating to diet','Many people have specific dietary requirements.'],['gourmet','adj','high-quality and sophisticated','We went to a gourmet restaurant for our anniversary.'],['organic','adj','grown without artificial chemicals','I prefer buying organic vegetables.'],['savoury','adj','salty or spicy rather than sweet','I prefer savoury foods to sweet ones.'],['seasonal','adj','available at a certain time of year','Eating seasonal produce is healthier.']],
    b78: [['culinary','adj','relating to cooking','She attended a culinary school in Paris.'],['gastronomic','adj','relating to the art of good eating','The city is a gastronomic paradise.'],['palatable','adj','pleasant to taste','The meal was simple but palatable.'],['plant-based','adj','made from plants, not animals','Plant-based diets are gaining popularity.'],['sustenance','n','food and drink as nourishment','Rice provides sustenance for billions of people.'],['processed food','phr','food altered from its natural state','Processed food often contains too much salt.'],['fermented','adj','food preserved by bacterial action','Fermented foods are good for gut health.'],['from scratch','phr','from basic ingredients, not premade','I made the pasta from scratch.']],
    b89: [['farm-to-table','phr','food sourced directly from local farms','Farm-to-table dining reduces carbon footprint.'],['artisanal','adj','made by skilled craftspeople','The artisanal cheese was exquisite.'],['epicurean','adj','devoted to fine food and drink','He leads an epicurean lifestyle.'],['umami','n','a savoury taste considered the fifth flavour','The broth had a rich umami flavour.'],['provenance','n','the origin of food','Knowing the provenance of your food matters.'],['molecular gastronomy','phr','scientific cooking techniques','Molecular gastronomy creates unusual textures.'],['nose-to-tail','phr','using every part of an animal','Nose-to-tail cooking reduces food waste.'],['terroir','n','the effect of environment on food flavour','Wine flavour is influenced by terroir.']]
  },
  'Sports & Fitness': {
    b56: [['exercise','n','physical activity for health','I try to exercise three times a week.'],['match','n','a competitive game','We watched a football match on Saturday.'],['team','n','a group playing together','I play for the local basketball team.'],['competition','n','an event where people compete','She entered a swimming competition.'],['win','v','to achieve first place','Our team won the tournament.'],['practise','v','to do something repeatedly to improve','I practise tennis every afternoon.'],['coach','n','a person who trains athletes','My coach helped me improve my technique.'],['score','n','the number of points in a game','The final score was three to one.']],
    b67: [['endurance','n','the ability to keep going for a long time','Marathon running requires great endurance.'],['opponent','n','a person you compete against','She defeated her opponent in straight sets.'],['spectator','n','someone who watches an event','Thousands of spectators filled the stadium.'],['sportsmanship','n','fair and generous behaviour in sport','Good sportsmanship means respecting your opponent.'],['amateur','adj','doing something for pleasure, not money','He plays football at an amateur level.'],['fitness regime','phr','a regular exercise plan','I follow a strict fitness regime.'],['stamina','n','physical or mental energy to last','Long-distance cycling requires tremendous stamina.'],['agility','n','ability to move quickly and easily','Agility is essential for badminton players.']],
    b78: [['sedentary','adj','involving little physical movement','A sedentary lifestyle increases health risks.'],['physique','n','the form and size of a person\'s body','Swimmers tend to have a lean physique.'],['doping','n','using banned substances in sport','Doping scandals have damaged the sport\'s reputation.'],['gruelling','adj','extremely tiring and demanding','The triathlon was absolutely gruelling.'],['prowess','n','great skill or ability','His athletic prowess earned him a scholarship.'],['camaraderie','n','trust and friendship among teammates','The camaraderie in our team is wonderful.'],['rehab','n','recovery treatment after injury','She is in rehab for a knee injury.'],['marginal gains','phr','small improvements that add up','The team focused on marginal gains.']],
    b89: [['proprioception','n','awareness of body position','Proprioception is key for balance sports.'],['periodisation','n','dividing training into phases','Periodisation helps athletes peak at the right time.'],['VO2 max','n','maximum oxygen uptake during exercise','Elite runners have an exceptionally high VO2 max.'],['biomechanics','n','study of body movement in sport','Biomechanics helps optimise running form.'],['overtraining syndrome','phr','illness from excessive exercise','Overtraining syndrome can derail a season.'],['anaerobic threshold','phr','intensity level where lactic acid builds up','Training at the anaerobic threshold improves speed.'],['psychomotor','adj','relating to mental processes and movement','Psychomotor skills are crucial in racquet sports.'],['ergogenic','adj','enhancing physical performance','Caffeine is a legal ergogenic aid.']]
  },
  'Technology & Gadgets': {
    b56: [['device','n','an electronic tool or machine','I use my device for work and entertainment.'],['internet','n','a global computer network','The internet has changed how we communicate.'],['download','v','to transfer data to your device','I downloaded a new app yesterday.'],['screen','n','a display on a device','Spending too much time looking at a screen is unhealthy.'],['password','n','a secret word for access','You should change your password regularly.'],['update','n','a new version of software','My phone needs a software update.'],['connect','v','to link to a network','I cannot connect to the Wi-Fi here.'],['search','v','to look for information online','I searched for the answer online.']],
    b67: [['innovation','n','a new method or invention','Technological innovation drives economic growth.'],['gadget','n','a small electronic device','He loves buying the latest gadgets.'],['artificial intelligence','phr','computer systems that mimic human thinking','Artificial intelligence is transforming healthcare.'],['data','n','information stored digitally','Companies collect vast amounts of user data.'],['digital literacy','phr','ability to use technology effectively','Digital literacy is essential in the modern workplace.'],['cybersecurity','n','protection of computer systems from attack','Cybersecurity is a growing concern for businesses.'],['streaming','n','watching content online in real time','Streaming services have replaced traditional TV.'],['cloud computing','phr','storing data on remote servers','Cloud computing allows access from anywhere.']],
    b78: [['algorithm','n','a set of rules for solving a problem','Social media algorithms decide what you see.'],['automation','n','using machines to do tasks without humans','Automation is replacing many factory jobs.'],['digital footprint','phr','the trail of data you leave online','Everyone should be aware of their digital footprint.'],['obsolescence','n','the state of becoming outdated','Planned obsolescence forces consumers to upgrade.'],['disruptive technology','phr','innovation that changes an industry','Electric cars are a disruptive technology.'],['bandwidth','n','the capacity of a data connection','Slow bandwidth makes video calls frustrating.'],['biometric','adj','using body features for identification','Biometric scanning is used at airports.'],['augmented reality','phr','overlaying digital info on the real world','Augmented reality has applications in education.']],
    b89: [['singularity','n','the point when AI surpasses human intelligence','Some experts predict a technological singularity by 2050.'],['quantum computing','phr','computing using quantum-mechanical phenomena','Quantum computing could revolutionise encryption.'],['blockchain','n','a decentralised digital ledger','Blockchain technology ensures transaction transparency.'],['Internet of Things','phr','everyday objects connected to the internet','The Internet of Things is making homes smarter.'],['deep learning','phr','AI using layered neural networks','Deep learning powers voice recognition systems.'],['digital divide','phr','the gap between those with and without tech access','The digital divide disproportionately affects rural areas.'],['technocracy','n','government by technical experts','Some argue for technocracy over traditional politics.'],['transhumanism','n','using technology to enhance human abilities','Transhumanism raises profound ethical questions.']]
  },
};

/* ─── GENERIC TOPIC GENERATOR ────────────────────────────────────────
   For topics without hand-crafted pools, generates contextual vocabulary.
   ──────────────────────────────────────────────────────────────────── */

function makeGenericVocab(tag, mod) {
  const topic = tag.toLowerCase();
  const modLabel = mod.charAt(0).toUpperCase() + mod.slice(1);
  const exStyle = mod === 'writing' ? 'formal' : mod === 'reading' ? 'academic' : mod === 'listening' ? 'spoken' : 'conversational';

  // Curated vocabulary by theme keywords
  const themeWords = {
    'health': { b56: [['healthy','adj','in good physical condition','Eating well keeps you healthy.'],['illness','n','a state of being unwell','Illness prevented her from attending.'],['exercise','n','physical activity for health','Regular exercise improves mental health.'],['medicine','n','a substance used to treat disease','The doctor prescribed some medicine.'],['symptom','n','a sign of illness','Fever is a common symptom.'],['diet','n','the food a person regularly eats','A balanced diet is essential.'],['recover','v','to get better after illness','She recovered quickly from the flu.'],['treatment','n','medical care for an illness','The treatment was effective.']], b67: [['well-being','n','the state of being healthy and happy','Exercise contributes to overall well-being.'],['chronic','adj','lasting for a long time','Chronic diseases require ongoing management.'],['sedentary','adj','involving little physical movement','A sedentary lifestyle increases health risks.'],['obesity','n','the condition of being very overweight','Childhood obesity is a growing concern.'],['immune system','phr','the body\'s defence against disease','A strong immune system fights infection.'],['diagnosis','n','identification of an illness','Early diagnosis improves outcomes.'],['preventive','adj','designed to stop something before it happens','Preventive healthcare saves lives.'],['nutritious','adj','full of nutrients','Nutritious food supports brain function.']], b78: [['holistic','adj','treating the whole person','A holistic approach considers mental and physical health.'],['epidemic','n','widespread occurrence of a disease','The obesity epidemic affects many countries.'],['rehabilitation','n','restoring health after illness or injury','Rehabilitation after surgery takes time.'],['mental resilience','phr','ability to cope with stress','Mental resilience is as important as physical fitness.'],['pharmaceutical','adj','relating to medicinal drugs','Pharmaceutical companies invest billions in research.'],['palliative','adj','relieving pain without curing','Palliative care focuses on quality of life.'],['pathogen','n','an organism causing disease','Handwashing removes pathogens.'],['comorbidity','n','two or more conditions at once','Comorbidity complicates treatment plans.']], b89: [['psychosomatic','adj','physical symptoms caused by mental factors','Stress can cause psychosomatic symptoms.'],['aetiology','n','the cause or origin of a disease','The aetiology of the condition is still unknown.'],['prophylaxis','n','action taken to prevent disease','Vaccination is a form of prophylaxis.'],['iatrogenic','adj','caused by medical treatment','Iatrogenic infections are a hospital concern.'],['epidemiology','n','the study of disease distribution','Epidemiology informs public health policy.'],['homeostasis','n','the body maintaining stable conditions','Homeostasis is essential for survival.'],['nosocomial','adj','originating in a hospital','Nosocomial infections affect patient recovery.'],['salutogenic','adj','focusing on factors that support health','A salutogenic approach promotes wellness.']] },
    'environment': { b56: [['pollution','n','harmful substances in the environment','Air pollution is a serious problem in cities.'],['recycle','v','to convert waste into reusable material','We recycle paper and plastic at home.'],['climate','n','the weather conditions in an area','The climate here is warm and dry.'],['wildlife','n','wild animals and plants','We must protect wildlife from extinction.'],['energy','n','power used for heat, light, and machines','Solar energy is clean and renewable.'],['waste','n','unwanted or unusable material','We need to reduce household waste.'],['protect','v','to keep safe from harm','We should protect endangered species.'],['natural','adj','existing in nature, not made by humans','Natural resources are limited.']], b67: [['carbon footprint','phr','total greenhouse gases produced by an activity','Flying increases your carbon footprint.'],['sustainability','n','using resources without depleting them','Sustainability is a key goal for businesses.'],['deforestation','n','clearing of forests','Deforestation destroys animal habitats.'],['renewable','adj','able to be replenished naturally','Wind and solar are renewable energy sources.'],['biodiversity','n','variety of plant and animal life','Biodiversity loss threatens ecosystems.'],['conservation','n','protection of natural resources','Conservation efforts have saved many species.'],['greenhouse effect','phr','warming caused by gases trapping heat','The greenhouse effect is intensifying.'],['ecosystem','n','a community of living organisms and their environment','Coral reefs are delicate ecosystems.']], b78: [['ecological footprint','phr','human demand on natural resources','Developed nations have a large ecological footprint.'],['carbon neutral','phr','having zero net carbon emissions','The company aims to become carbon neutral by 2030.'],['desertification','n','land becoming desert','Desertification threatens food production in Africa.'],['anthropogenic','adj','caused by human activity','Most climate change is anthropogenic.'],['mitigation','n','reducing the severity of something','Climate mitigation requires global cooperation.'],['biodegradable','adj','able to decompose naturally','Biodegradable packaging reduces landfill waste.'],['habitat fragmentation','phr','splitting habitats into smaller areas','Habitat fragmentation isolates animal populations.'],['carrying capacity','phr','the maximum population an area can support','Earth\'s carrying capacity is a subject of debate.']], b89: [['tipping point','phr','the critical point of irreversible change','Scientists warn of climate tipping points.'],['rewilding','n','restoring an area to its natural state','Rewilding projects reintroduce native species.'],['sequestration','n','capturing and storing carbon dioxide','Carbon sequestration is a key mitigation strategy.'],['bioaccumulation','n','buildup of chemicals in organisms','Bioaccumulation of mercury harms marine life.'],['albedo effect','phr','reflectivity of the Earth\'s surface','Melting ice reduces the albedo effect.'],['ecocide','n','large-scale destruction of the environment','Some advocate making ecocide a criminal offence.'],['phytoremediation','n','using plants to clean polluted soil','Phytoremediation offers a low-cost cleanup method.'],['Anthropocene','n','the current geological age of human impact','We are living in the Anthropocene era.']] },
    'crime': { b56: [['crime','n','an illegal act','Crime rates have dropped in recent years.'],['steal','v','to take something without permission','Someone stole my bicycle last week.'],['police','n','the official force maintaining order','The police arrested the suspect.'],['prison','n','a place where criminals are held','He was sentenced to five years in prison.'],['law','n','a system of rules enforced by authority','Everyone must obey the law.'],['punishment','n','a penalty for breaking the law','The punishment for theft is severe.'],['safe','adj','free from danger','This neighbourhood is very safe.'],['victim','n','a person harmed by a crime','The victim reported the incident immediately.']], b67: [['offender','n','a person who commits a crime','Young offenders need rehabilitation, not just punishment.'],['deterrent','n','something that discourages an action','Longer sentences act as a deterrent.'],['rehabilitation','n','restoring someone to normal life','Rehabilitation programmes reduce reoffending.'],['juvenile','adj','relating to young people','Juvenile crime requires a different approach.'],['fraud','n','the crime of deceiving for financial gain','Online fraud is increasingly common.'],['vandalism','n','deliberate destruction of property','Vandalism costs the council thousands each year.'],['surveillance','n','close observation, especially by cameras','CCTV surveillance helps deter crime.'],['penalty','n','a punishment for breaking a law or rule','The penalty for speeding has increased.']], b78: [['recidivism','n','the tendency to reoffend','Recidivism rates remain stubbornly high.'],['incarceration','n','the state of being imprisoned','Mass incarceration has not reduced crime significantly.'],['white-collar crime','phr','non-violent crime for financial gain','White-collar crime costs economies billions.'],['mitigating circumstances','phr','factors that reduce blame','The court considered the mitigating circumstances.'],['restorative justice','phr','repairing harm through dialogue','Restorative justice brings victims and offenders together.'],['penal system','phr','the system of punishment for crime','Reform of the penal system is overdue.'],['custodial sentence','phr','a prison sentence','He received a custodial sentence of three years.'],['culpable','adj','deserving blame','The company was found culpable for the accident.']], b89: [['recidivist','n','a repeat offender','The programme targets recidivists with intensive support.'],['jurisprudence','n','the theory and philosophy of law','Jurisprudence explores the foundations of justice.'],['extenuating','adj','making an offence seem less serious','Extenuating factors influenced the judge\'s decision.'],['probation','n','supervision instead of prison','She was placed on probation for two years.'],['clemency','n','mercy or leniency','The governor granted clemency to the prisoner.'],['malfeasance','n','wrongdoing by a public official','The politician was charged with malfeasance.'],['habeas corpus','phr','right not to be held without trial','Habeas corpus protects individual liberty.'],['plea bargain','phr','an agreement to plead guilty for a lesser charge','The defendant accepted a plea bargain.']] },
    'media': { b56: [['news','n','newly received information about events','I watch the news every evening.'],['social media','phr','websites for sharing content','Social media connects people worldwide.'],['report','n','an account of events','The reporter wrote a detailed report.'],['article','n','a piece of writing in a publication','I read an interesting article online.'],['advertise','v','to promote a product publicly','Companies advertise heavily on television.'],['broadcast','v','to transmit a programme','The match was broadcast live on TV.'],['headline','n','the title of a news story','The headline grabbed my attention.'],['journalist','n','a person who writes for the media','The journalist investigated the scandal.']], b67: [['biased','adj','unfairly favouring one side','Some news sources are politically biased.'],['censorship','n','suppression of information','Censorship limits freedom of expression.'],['circulation','n','the number of copies sold','The newspaper has a large circulation.'],['editorial','n','an opinion article by an editor','The editorial criticised government policy.'],['tabloid','n','a newspaper with sensational stories','Tabloids often exaggerate the truth.'],['press conference','phr','a meeting to give information to journalists','The minister held a press conference.'],['media coverage','phr','the extent of reporting on a topic','Media coverage of the event was extensive.'],['breaking news','phr','newly received urgent information','Breaking news interrupted the programme.']], b78: [['misinformation','n','false information spread without intent to harm','Misinformation spreads rapidly online.'],['disinformation','n','false information spread deliberately','State-sponsored disinformation is a global threat.'],['sensationalism','n','exaggerating news for attention','Sensationalism undermines public trust.'],['media literacy','phr','ability to analyse media messages','Schools should teach media literacy.'],['echo chamber','phr','environment reinforcing existing beliefs','Social media creates echo chambers.'],['propaganda','n','biased information promoting a viewpoint','Propaganda was widely used during the war.'],['whistleblower','n','a person who exposes wrongdoing','The whistleblower revealed financial fraud.'],['defamation','n','damaging someone\'s reputation falsely','The actor sued for defamation.']], b89: [['fourth estate','phr','the press as a political force','The fourth estate plays a vital role in democracy.'],['Overton window','phr','the range of acceptable public discourse','Social media has shifted the Overton window.'],['manufactured consent','phr','media shaping public opinion for elites','Chomsky wrote about manufactured consent.'],['infotainment','n','news presented as entertainment','Infotainment blurs the line between fact and fun.'],['yellow journalism','phr','sensational or biased reporting','Yellow journalism prioritises clicks over accuracy.'],['astroturfing','n','fake grassroots campaigns','Astroturfing creates an illusion of public support.'],['churnalism','n','journalism relying on press releases','Churnalism reduces investigative reporting.'],['citizen journalism','phr','reporting by ordinary people','Citizen journalism has grown through smartphones.']] },
    'default': { b56: [['important','adj','of great value or significance','Education is very important.'],['improve','v','to make or become better','I want to improve my English.'],['benefit','n','an advantage or profit','Regular exercise has many benefits.'],['common','adj','occurring frequently','This is a common mistake.'],['method','n','a way of doing something','This method is very effective.'],['opportunity','n','a chance to do something','Education provides opportunities.'],['challenge','n','a difficult task','Learning a language is a challenge.'],['develop','v','to grow or progress','Skills develop over time.']], b67: [['significant','adj','large enough to be noticed','There has been a significant improvement.'],['contribute','v','to give or add to something','Volunteers contribute to community development.'],['perspective','n','a point of view','We should consider different perspectives.'],['essential','adj','absolutely necessary','Water is essential for survival.'],['consequence','n','a result or effect','Pollution has serious consequences.'],['tendency','n','an inclination to behave in a certain way','There is a tendency to rely on technology.'],['alternative','n','another option','Public transport is an alternative to driving.'],['emphasis','n','special importance given to something','There is growing emphasis on sustainability.']], b78: [['unprecedented','adj','never known or done before','The pandemic was an unprecedented crisis.'],['paradigm','n','a typical example or model','This discovery shifted the scientific paradigm.'],['disparity','n','a great difference','Income disparity is growing worldwide.'],['alleviate','v','to make less severe','Aid programmes alleviate poverty.'],['catalyst','n','something that causes change','Technology was a catalyst for economic growth.'],['nuanced','adj','having subtle differences','The issue requires a nuanced approach.'],['exacerbate','v','to make worse','Climate change exacerbates food insecurity.'],['contentious','adj','causing disagreement','Immigration is a contentious topic.']], b89: [['paradigm shift','phr','a fundamental change in approach','Remote work represents a paradigm shift.'],['dichotomy','n','a division into two opposing groups','The urban-rural dichotomy is oversimplified.'],['ameliorate','v','to make something better','Education can ameliorate social inequality.'],['ubiquitous','adj','present everywhere','Smartphones are now ubiquitous.'],['axiom','n','a self-evident truth','Equality of opportunity is a social axiom.'],['zeitgeist','n','the spirit of the age','Sustainability defines the current zeitgeist.'],['hegemony','n','dominance of one group over others','Cultural hegemony shapes public opinion.'],['epistemological','adj','relating to the theory of knowledge','Epistemological debates underpin scientific inquiry.']] },
  };

  // Find matching pool
  function findPool(tag) {
    const t = tag.toLowerCase();
    for (const key in themeWords) {
      if (t.includes(key)) return themeWords[key];
    }
    return themeWords['default'];
  }

  return findPool(tag);
}

/* ─── BUILD ALL 200 TOPICS ───────────────────────────────────────────── */

function buildTopicDef(tag, mod, vocabData) {
  const modLabel = mod.charAt(0).toUpperCase() + mod.slice(1);
  const title = `IELTS ${modLabel} Vocabulary: ${tag}`;

  const introTemplates = {
    speaking: `${tag} is a frequently tested topic in IELTS Speaking. Questions about ${tag.toLowerCase()} can appear in any of the three parts, from simple Part 1 questions to abstract Part 3 discussions. Having a wide range of vocabulary for this subject will help you speak fluently, demonstrate lexical resource, and avoid hesitation.`,
    writing: `${tag} is a common theme in IELTS Writing Task 2, where candidates must present well-structured arguments using formal academic vocabulary. A strong command of ${tag.toLowerCase()} vocabulary allows you to express complex ideas precisely, use appropriate collocations, and achieve a higher score for lexical resource.`,
    reading: `Academic passages about ${tag.toLowerCase()} appear regularly in IELTS Reading. Understanding the specialised vocabulary used in these texts helps you answer questions faster and more accurately. The words below range from common academic terms to highly technical vocabulary found in the most challenging passages.`,
    listening: `${tag} vocabulary frequently appears in IELTS Listening, from everyday conversations in Sections 1–2 to academic discussions in Sections 3–4. Recognising these words when spoken helps you follow the audio, complete answers correctly, and avoid common spelling mistakes that cost marks.`,
  };

  const tipsTemplates = {
    speaking: [
      `Practise using ${tag.toLowerCase()} vocabulary in full sentences, not isolated words.`,
      `Record yourself discussing ${tag.toLowerCase()} and review for naturalness.`,
      `Prepare a short story or example related to ${tag.toLowerCase()} for Part 2.`,
      `Learn collocations — examiners notice natural word combinations.`,
    ],
    writing: [
      `Use ${tag.toLowerCase()} vocabulary precisely — avoid vague or informal language.`,
      `Practise paraphrasing — restate the question using different ${tag.toLowerCase()} terms.`,
      `Organise vocabulary into for/against lists when preparing arguments.`,
      `Read model essays on ${tag.toLowerCase()} to see vocabulary used in context.`,
    ],
    reading: [
      `When you meet unknown ${tag.toLowerCase()} terms, use context clues to infer meaning.`,
      `Build a vocabulary notebook organised by passage topic.`,
      `Focus on word families — knowing the noun, verb, and adjective forms helps.`,
      `Practise scanning passages for keywords related to ${tag.toLowerCase()}.`,
    ],
    listening: [
      `Listen to podcasts and lectures about ${tag.toLowerCase()} to build recognition.`,
      `Practise spelling ${tag.toLowerCase()} terms correctly — spelling errors cost marks.`,
      `Learn how these words sound in connected speech, not just in isolation.`,
      `Use dictation exercises with ${tag.toLowerCase()} content.`,
    ],
  };

  const mistakeTemplates = {
    speaking: [
      `Using overly simple vocabulary when more precise ${tag.toLowerCase()} terms exist.`,
      `Repeating the same word instead of using synonyms.`,
      `Mispronouncing key ${tag.toLowerCase()} terms.`,
      `Using memorised phrases that sound unnatural.`,
    ],
    writing: [
      `Using informal language when formal ${tag.toLowerCase()} terms are expected.`,
      `Spelling errors in key ${tag.toLowerCase()} vocabulary.`,
      `Using words without fully understanding their meaning — this leads to misuse.`,
      `Overusing a narrow range of ${tag.toLowerCase()} vocabulary instead of demonstrating range.`,
    ],
    reading: [
      `Assuming a word has the same meaning across all contexts.`,
      `Panicking when encountering unfamiliar ${tag.toLowerCase()} terms instead of using context.`,
      `Confusing similar-looking words in ${tag.toLowerCase()} passages.`,
      `Spending too long on one word instead of reading for overall meaning.`,
    ],
    listening: [
      `Mishearing similar-sounding ${tag.toLowerCase()} words in the audio.`,
      `Writing incorrect spelling for ${tag.toLowerCase()} terms on the answer sheet.`,
      `Failing to recognise paraphrased vocabulary from the question.`,
      `Losing focus when unfamiliar ${tag.toLowerCase()} words are used in the recording.`,
    ],
  };

  const faqTemplates = {
    speaking: [`How much ${tag.toLowerCase()} vocabulary do I need for band 7?`, `You need to use a range of vocabulary accurately and with some flexibility. Aim to know at least 15-20 key words and phrases for this topic. The key is using them naturally in context, not memorising long lists.`],
    writing: [`Should I use very advanced ${tag.toLowerCase()} vocabulary in my essay?`, `Use vocabulary that you can control accurately. A few well-chosen advanced words are better than many used incorrectly. The examiner values precision and appropriacy over complexity.`],
    reading: [`What should I do if I encounter unknown ${tag.toLowerCase()} vocabulary in the passage?`, `Do not panic. Use context clues, word roots, and surrounding sentences to infer the meaning. You do not need to understand every word to answer the questions correctly.`],
    listening: [`How can I improve my recognition of ${tag.toLowerCase()} vocabulary in the audio?`, `Regular exposure is key. Listen to English podcasts, lectures, and news about ${tag.toLowerCase()}. Practise dictation exercises and focus on how words sound in connected speech.`],
  };

  const defaultColls = [
    [`key ${tag.toLowerCase()} issue`, `Climate change is a key ${tag.toLowerCase()} issue of our time.`],
    [`address ${tag.toLowerCase()} challenges`, `Governments must address ${tag.toLowerCase()} challenges effectively.`],
    [`${tag.toLowerCase()} awareness`, `Public ${tag.toLowerCase()} awareness has increased significantly.`],
    [`${tag.toLowerCase()} policy`, `New ${tag.toLowerCase()} policy was introduced last year.`],
    [`impact on ${tag.toLowerCase()}`, `Technology has had a significant impact on ${tag.toLowerCase()}.`],
  ];

  return {
    title,
    mod,
    tag,
    intro: introTemplates[mod],
    b56: vocabData.b56,
    b67: vocabData.b67,
    b78: vocabData.b78,
    b89: vocabData.b89,
    colls: defaultColls,
    mistakes: mistakeTemplates[mod],
    tips: tipsTemplates[mod],
    faq: faqTemplates[mod],
  };
}

/* ─── ASSEMBLE ALL TOPICS ───────────────────────────────────────────── */

const allTopics = [];

// Speaking topics - hand-crafted first 5 + generated rest
speakingTopics.forEach(t => {
  const vocabData = t.words;
  const topic = buildTopicDef(t.tag, 'speaking', vocabData);
  if (t.words.colls) topic.colls = t.words.colls || topic.colls;
  allTopics.push(topic);
});

speakingRest.forEach(tag => {
  const pool = vocabPools[tag] || makeGenericVocab(tag, 'speaking');
  allTopics.push(buildTopicDef(tag, 'speaking', pool));
});

// Writing topics
writingFull.forEach(tag => {
  const pool = makeGenericVocab(tag, 'writing');
  allTopics.push(buildTopicDef(tag, 'writing', pool));
});

// Reading topics
readingFull.forEach(tag => {
  const pool = makeGenericVocab(tag, 'reading');
  allTopics.push(buildTopicDef(tag, 'reading', pool));
});

// Listening topics
listeningFull.forEach(tag => {
  const pool = makeGenericVocab(tag, 'listening');
  allTopics.push(buildTopicDef(tag, 'listening', pool));
});

console.log(`Generated ${allTopics.length} topics`);
console.log(`  Speaking: ${allTopics.filter(t => t.mod === 'speaking').length}`);
console.log(`  Writing: ${allTopics.filter(t => t.mod === 'writing').length}`);
console.log(`  Reading: ${allTopics.filter(t => t.mod === 'reading').length}`);
console.log(`  Listening: ${allTopics.filter(t => t.mod === 'listening').length}`);

// Write to JSON
fs.writeFileSync('/tmp/vocab-topics.json', JSON.stringify(allTopics, null, 0));
console.log('Written to /tmp/vocab-topics.json');
