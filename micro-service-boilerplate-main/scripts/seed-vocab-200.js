#!/usr/bin/env node
/**
 * Seed 200 IELTS Vocabulary articles to Supabase PostgreSQL.
 * 50 Speaking | 50 Writing | 50 Reading | 50 Listening
 * Each article ≥ 500 words with band-level vocabulary tables.
 *
 * Usage: SUPABASE_DB_URL="..." node scripts/seed-vocab-200.js
 */
const { randomBytes } = require('crypto');
const { Pool } = require('pg');

const DB_URL = process.env.SUPABASE_DB_URL || '';
const genId = () => randomBytes(12).toString('hex');
const slugify = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ═══════════════════════════════════════════════════════════════════
   20 VOCABULARY POOLS — 8 words per band × 4 bands + 6 collocations
   ═══════════════════════════════════════════════════════════════════ */
const POOLS = {

// ── 1. FAMILY & PERSONAL ──
family: {
  b56:[['relative','n','a member of your family','I have many relatives living in the same city.'],['sibling','n','a brother or sister','I have two siblings, an older brother and a younger sister.'],['upbringing','n','how a child is raised','My upbringing was quite traditional.'],['close-knit','adj','having strong family bonds','We are a very close-knit family.'],['look after','phr v','to take care of someone','My grandmother looks after the children.'],['get along with','phr v','to have a good relationship','I get along with my cousins really well.'],['supportive','adj','giving help and encouragement','My parents have always been supportive of my decisions.'],['generation','n','people born around the same time','Three generations live under one roof in my family.']],
  b67:[['unconditional','adj','without any conditions or limits','A parent\'s love is often unconditional.'],['nuclear family','phr','parents and their children only','The nuclear family is becoming less common.'],['extended family','phr','relatives beyond parents and children','My extended family gathers every holiday.'],['bond','n','a strong connection between people','The bond between the twins is remarkable.'],['sibling rivalry','phr','competition between brothers or sisters','Sibling rivalry is a natural part of growing up.'],['dependent','n','a person who relies on another','Tax benefits increase for each dependent.'],['nurture','v','to care for and encourage growth','Parents nurture their children through difficult times.'],['inherit','v','to receive traits or property from parents','She inherited her mother\'s musical talent.']],
  b78:[['familial','adj','relating to a family','Familial obligations often influence career choices.'],['intergenerational','adj','between different generations','Intergenerational conflict can arise from differing values.'],['kinship','n','a family relationship or connection','Kinship networks provide essential social support.'],['patriarch','n','the male head of a family','My grandfather was the patriarch of our family.'],['estranged','adj','no longer close or in contact','He became estranged from his siblings after the dispute.'],['domestic','adj','relating to the home or family','Domestic responsibilities should be shared equally.'],['autonomy','n','the right to make your own decisions','Teenagers gradually seek more autonomy from parents.'],['filial','adj','relating to a son or daughter','Filial duty is deeply valued in many Asian cultures.']],
  b89:[['nepotism','n','favouring relatives in jobs or positions','Nepotism undermines meritocracy in the workplace.'],['consanguinity','n','blood relationship','Laws limit marriage between people of close consanguinity.'],['primogeniture','n','the right of the eldest child to inherit','Primogeniture shaped European aristocratic succession.'],['dysfunctional','adj','not operating normally, especially a family','Growing up in a dysfunctional family affects mental health.'],['genealogy','n','the study of family history','She traced her genealogy back five centuries.'],['progeny','n','offspring or descendants','His artistic progeny continued the family tradition.'],['lineage','n','direct descent from an ancestor','The royal lineage can be traced to the medieval era.'],['enmeshment','n','unhealthy over-involvement in a family','Enmeshment can prevent healthy individual development.']],
  colls:[['family values','Strong family values shape children\'s character.'],['generation gap','The generation gap is wider in times of rapid change.'],['family reunion','Our annual family reunion brings everyone together.'],['raise a family','Many couples move to the suburbs to raise a family.'],['immediate family','Only immediate family attended the private ceremony.'],['family dynamics','Family dynamics change when a new baby arrives.']]
},

// ── 2. WORK & CAREER ──
work: {
  b56:[['colleague','n','a person you work with','I have lunch with my colleagues every day.'],['salary','n','a fixed regular payment for work','She earns a good salary as an engineer.'],['boss','n','the person in charge at work','My boss is very understanding about flexible hours.'],['interview','n','a formal meeting to assess a candidate','I have a job interview tomorrow morning.'],['apply','v','to make a formal request for a job','I applied for three positions last week.'],['experience','n','knowledge gained from doing something','She has ten years of experience in marketing.'],['office','n','a place where people work','The office is located in the city centre.'],['responsibility','n','a duty or task you must do','My main responsibility is managing the team budget.']],
  b67:[['promotion','n','advancement to a higher position','He received a promotion after two years.'],['deadline','n','the latest time something must be done','We must meet the deadline by Friday.'],['workload','n','the amount of work to be done','My workload has increased significantly this quarter.'],['productive','adj','achieving a lot of work','I am most productive in the morning.'],['resign','v','to voluntarily leave a job','She resigned to start her own business.'],['candidate','n','a person applying for a job','The ideal candidate should have five years of experience.'],['networking','n','building professional relationships','Networking is essential for career development.'],['freelance','adj','self-employed and working for different clients','Freelance work offers flexibility but less security.']],
  b78:[['remuneration','n','payment for work or services','The remuneration package includes health insurance.'],['entrepreneurial','adj','having the qualities of starting businesses','An entrepreneurial mindset values innovation and risk-taking.'],['burnout','n','exhaustion from overwork','Burnout is a growing problem among healthcare workers.'],['outsource','v','to hire an external company for tasks','Many firms outsource customer service to reduce costs.'],['sabbatical','n','a period of leave from work','She took a sabbatical to write a book.'],['meritocracy','n','a system rewarding ability and effort','A true meritocracy gives everyone an equal chance.'],['appraisal','n','a formal assessment of work performance','My annual appraisal was very positive.'],['occupational','adj','relating to a job or profession','Occupational hazards vary across industries.']],
  b89:[['vocational','adj','relating to skills for a specific job','Vocational training prepares students for the workforce.'],['pecuniary','adj','relating to money','The pecuniary rewards of the job are substantial.'],['synergy','n','combined effort exceeding individual contributions','The merger created synergy between the two departments.'],['gig economy','phr','a market of short-term freelance work','The gig economy has transformed how people earn a living.'],['glass ceiling','phr','an invisible barrier to advancement','Many women still face the glass ceiling in corporate roles.'],['presenteeism','n','being at work while unwell or unproductive','Presenteeism costs businesses more than absenteeism.'],['portfolio career','phr','multiple part-time roles instead of one job','A portfolio career suits those who value variety.'],['golden handshake','phr','a large payment on leaving a company','The CEO received a generous golden handshake upon retirement.']],
  colls:[['job satisfaction','Job satisfaction matters more than salary for many workers.'],['career ladder','Climbing the career ladder requires both skill and perseverance.'],['work-life balance','Maintaining a healthy work-life balance is essential.'],['job security','Government roles often offer greater job security.'],['career prospects','The industry offers excellent career prospects for graduates.'],['enter the workforce','Many young people enter the workforce without formal training.']]
},

// ── 3. EDUCATION & LEARNING ──
education: {
  b56:[['student','n','a person who studies at a school or university','She is a university student studying biology.'],['teacher','n','a person who teaches','My favourite teacher inspired me to study science.'],['exam','n','a formal test of knowledge','I have a maths exam next week.'],['homework','n','school work done at home','I spend about two hours on homework every evening.'],['skill','n','an ability developed through training','Communication skills are vital in every profession.'],['knowledge','n','facts and information learned','Knowledge of history helps us understand the present.'],['course','n','a series of lessons in a subject','I enrolled in an online course in photography.'],['degree','n','a qualification from a university','She earned a degree in computer science.']],
  b67:[['curriculum','n','the subjects in a course of study','The national curriculum includes science and humanities.'],['tuition','n','teaching or the fee for it','University tuition fees have risen sharply.'],['scholarship','n','a grant for a student based on merit','She won a scholarship to study abroad.'],['academic','adj','relating to education and scholarship','His academic performance improved dramatically.'],['discipline','n','a branch of knowledge or training in obedience','History is a fascinating academic discipline.'],['enrol','v','to register for a course','I plan to enrol in a language class.'],['assessment','n','the process of evaluating someone','Continuous assessment replaces final exams in some schools.'],['qualify','v','to gain the skills or certificates needed','She qualified as a doctor last year.']],
  b78:[['pedagogy','n','the method and practice of teaching','Modern pedagogy emphasises student-centred learning.'],['tertiary','adj','relating to higher education','Tertiary education should be accessible to all.'],['vocational','adj','relating to skills for a specific occupation','Vocational courses prepare students for practical careers.'],['rote learning','phr','learning through repetition','Rote learning is less effective than understanding concepts.'],['critical thinking','phr','analysing and evaluating information objectively','Critical thinking is a core skill for university students.'],['holistic','adj','considering the whole person','A holistic education develops both intellect and character.'],['syllabus','n','the outline of subjects in a course','The syllabus covers topics from genetics to ecology.'],['accreditation','n','official recognition of standards','Accreditation ensures the programme meets quality benchmarks.']],
  b89:[['andragogy','n','the method of teaching adult learners','Andragogy differs from pedagogy in emphasising self-direction.'],['didactic','adj','intended to teach or instruct','The professor\'s didactic style was highly effective.'],['autodidact','n','a self-taught person','Many great inventors were autodidacts.'],['heuristic','adj','encouraging self-discovery in learning','Heuristic methods let students find answers independently.'],['epistemology','n','the study of knowledge and belief','Epistemology asks how we know what we know.'],['Socratic method','phr','teaching through questioning','The Socratic method develops deeper understanding.'],['credentialism','n','overemphasis on formal qualifications','Credentialism can disadvantage talented people without degrees.'],['meritocratic','adj','based on ability rather than privilege','A meritocratic education system rewards effort and talent.']],
  colls:[['higher education','Access to higher education should not depend on wealth.'],['academic achievement','Academic achievement is only one measure of success.'],['lifelong learning','Lifelong learning keeps the mind sharp at any age.'],['distance learning','Distance learning became widespread during the pandemic.'],['learning curve','The learning curve for the new software was steep.'],['drop out','Financial pressures cause many students to drop out.']]
},

// ── 4. PLACES & URBAN ──
places: {
  b56:[['city','n','a large and important town','I grew up in a busy city.'],['village','n','a small settlement in the countryside','My grandparents live in a quiet village.'],['suburb','n','a residential area outside a city centre','The suburbs are popular with young families.'],['population','n','the number of people in an area','The city has a population of two million.'],['neighbour','n','a person living near you','My neighbour is very friendly and helpful.'],['building','n','a structure with walls and a roof','The building was designed by a famous architect.'],['downtown','adv','in the central part of a city','I work downtown near the main square.'],['area','n','a region or part of a place','This area is known for its nightlife.']],
  b67:[['cosmopolitan','adj','having people from many countries','London is a cosmopolitan city.'],['outskirts','n','the outer parts of a city','A new shopping centre was built on the outskirts.'],['infrastructure','n','basic systems like roads and power','The city needs better infrastructure to support growth.'],['congestion','n','overcrowding, especially traffic','Traffic congestion is worst during rush hour.'],['residential','adj','designed for people to live in','This is a quiet residential neighbourhood.'],['landmark','n','an easily recognised building or feature','The tower is the city\'s most famous landmark.'],['municipality','n','a city or town with its own government','The municipality invested in public parks.'],['commute','v','to travel regularly between home and work','I commute thirty minutes each way by train.']],
  b78:[['gentrification','n','renovating an area to attract wealthier residents','Gentrification has displaced long-term residents.'],['metropolis','n','a very large and important city','Tokyo is a sprawling metropolis of over thirteen million.'],['urban sprawl','phr','uncontrolled city expansion into surrounding areas','Urban sprawl increases dependence on cars.'],['zoning','n','dividing land into areas for specific uses','Strict zoning separates industrial and residential areas.'],['urban decay','phr','deterioration of a city area','Urban decay can be reversed through investment.'],['amenities','n pl','useful facilities in an area','The neighbourhood has excellent amenities.'],['densely populated','phr','having many people in a small area','Hong Kong is one of the most densely populated cities.'],['regeneration','n','the renewal of a run-down area','The regeneration project transformed the waterfront.']],
  b89:[['conurbation','n','an extended urban area of merged cities','The Ruhr conurbation is one of Europe\'s largest.'],['megalopolis','n','a very large continuous urban area','The BosWash corridor forms a megalopolis.'],['polycentrism','n','having multiple centres of activity','Polycentrism reduces pressure on a single city core.'],['placemaking','n','designing public spaces for well-being','Placemaking turns neglected areas into community hubs.'],['brownfield','adj','previously used industrial land','Building on brownfield sites prevents green-belt loss.'],['transit-oriented','adj','designed around public transport hubs','Transit-oriented development reduces car dependency.'],['urban morphology','phr','the study of city form and structure','Urban morphology reveals how cities evolve over centuries.'],['civic vernacular','phr','the everyday character of a city','The civic vernacular of Barcelona includes its iconic tiles.']],
  colls:[['city centre','The city centre is pedestrianised at weekends.'],['cost of living','The cost of living in the capital keeps rising.'],['public spaces','Well-designed public spaces bring communities together.'],['housing shortage','A housing shortage is driving up rents.'],['urban planning','Good urban planning improves quality of life.'],['rural area','Internet access remains limited in many rural areas.']]
},

// ── 5. TRAVEL & TOURISM ──
travel: {
  b56:[['journey','n','the act of travelling from one place to another','The journey took about three hours by train.'],['tourist','n','a person visiting a place for pleasure','The city attracts millions of tourists every year.'],['flight','n','a trip by aeroplane','Our flight to London departs at nine.'],['accommodation','n','a place to stay','We booked accommodation near the beach.'],['sightseeing','n','visiting places of interest','We spent the day sightseeing in Rome.'],['souvenir','n','something bought as a reminder of a place','I bought a souvenir for my friend.'],['passport','n','a document for international travel','Make sure your passport is up to date.'],['destination','n','the place you are travelling to','Bali is a popular holiday destination.']],
  b67:[['itinerary','n','a planned route or schedule','Our itinerary includes three cities in ten days.'],['backpacker','n','a budget traveller carrying a backpack','Hostels are popular with backpackers.'],['excursion','n','a short trip for pleasure','We took a day excursion to the mountains.'],['resort','n','a place designed for holidays','The resort offers an all-inclusive package.'],['cultural exchange','phr','sharing traditions between peoples','Travel promotes cultural exchange and understanding.'],['jet lag','n','tiredness from flying across time zones','I suffered from jet lag for two days.'],['off the beaten track','phr','away from popular tourist areas','We prefer travelling off the beaten track.'],['travel agency','phr','a business arranging travel for clients','The travel agency booked everything for us.']],
  b78:[['ecotourism','n','tourism that protects the environment','Ecotourism is growing in Costa Rica.'],['sustainable travel','phr','travelling with minimal environmental impact','Sustainable travel means choosing trains over flights.'],['heritage site','phr','a place of historical importance','The temple is a UNESCO World Heritage site.'],['wanderlust','n','a strong desire to travel','Her wanderlust took her to forty countries.'],['immersive','adj','providing a deep, engaging experience','The immersive tour let us live like locals.'],['pilgrimage','n','a journey to a sacred place','Thousands make the pilgrimage each year.'],['overtourism','n','too many visitors harming a destination','Venice suffers from overtourism in summer.'],['nomadic','adj','moving from place to place','She leads a nomadic lifestyle, working remotely.']],
  b89:[['circumnavigation','n','travelling all the way around something','Magellan\'s circumnavigation proved the Earth was round.'],['cultural commodification','phr','turning culture into products for tourists','Cultural commodification can erode authentic traditions.'],['acculturation','n','adopting another culture\'s traits','Acculturation occurs naturally through long-term travel.'],['liminal space','phr','a transitional or in-between place','Airports are liminal spaces between departure and arrival.'],['flânerie','n','the art of leisurely strolling and observing','Flânerie transforms a simple walk into cultural exploration.'],['dark tourism','phr','visiting sites associated with death or tragedy','Dark tourism raises ethical questions about respect.'],['peripatetic','adj','travelling from place to place','His peripatetic career took him to six continents.'],['cosmopolite','n','a person at home in many countries','A true cosmopolite feels comfortable in any culture.']],
  colls:[['travel broadens the mind','They say travel broadens the mind.'],['package holiday','Package holidays include flights, hotel, and transfers.'],['tourist attraction','The museum is the city\'s top tourist attraction.'],['travel insurance','Always buy travel insurance before going abroad.'],['round trip','The round trip ticket was much cheaper than one-way.'],['peak season','Prices are highest during the peak season.']]
},

// ── 6. FOOD & COOKING ──
food: {
  b56:[['delicious','adj','very tasty','The food at the restaurant was delicious.'],['recipe','n','instructions for preparing a dish','I followed my grandmother\'s recipe carefully.'],['ingredient','n','a food item used in cooking','Fresh ingredients make a big difference.'],['spicy','adj','having a strong hot flavour','I enjoy spicy food like Thai curries.'],['homemade','adj','made at home, not bought','Homemade bread tastes much better than store-bought.'],['portion','n','an amount of food for one person','The portion sizes at that restaurant are generous.'],['takeaway','n','food bought to eat elsewhere','We ordered a takeaway for dinner.'],['snack','n','a small amount of food between meals','I usually have a healthy snack in the afternoon.']],
  b67:[['nutritious','adj','containing nutrients that are good for health','Fruits and vegetables are very nutritious.'],['cuisine','n','a style of cooking from a region','Japanese cuisine is known for its freshness.'],['appetising','adj','looking or smelling delicious','The dish looked incredibly appetising.'],['dietary','adj','relating to a person\'s diet','Many people have specific dietary requirements.'],['gourmet','adj','high-quality and sophisticated food','We went to a gourmet restaurant for our anniversary.'],['organic','adj','grown without artificial chemicals','I prefer buying organic vegetables.'],['savoury','adj','salty or spicy rather than sweet','I prefer savoury foods to sweet desserts.'],['seasonal','adj','available at a particular time of year','Eating seasonal produce supports local farmers.']],
  b78:[['culinary','adj','relating to cooking','She attended a prestigious culinary school in Paris.'],['gastronomic','adj','relating to the art of good eating','The region is a gastronomic paradise.'],['palatable','adj','pleasant to taste','The hospital food was surprisingly palatable.'],['plant-based','adj','made from plants, not animals','Plant-based diets are gaining mainstream popularity.'],['sustenance','n','food and drink as nourishment','Rice provides sustenance for billions of people worldwide.'],['processed food','phr','food altered from its natural state','Processed food often contains too much salt and sugar.'],['fermented','adj','food preserved through bacterial action','Fermented foods like yoghurt improve gut health.'],['from scratch','phr','from basic ingredients, not premade','I made the pasta sauce from scratch.']],
  b89:[['farm-to-table','phr','food sourced directly from local farms','Farm-to-table dining reduces the carbon footprint of food.'],['artisanal','adj','made by skilled craftspeople in small batches','The artisanal cheese was absolutely exquisite.'],['epicurean','adj','devoted to fine food and drink','He leads an epicurean lifestyle.'],['umami','n','a savoury taste, the fifth basic flavour','The mushroom broth had a rich umami flavour.'],['provenance','n','the place of origin of food','Consumers increasingly care about food provenance.'],['molecular gastronomy','phr','scientific techniques in cooking','Molecular gastronomy creates unexpected textures.'],['nose-to-tail','phr','cooking using every part of an animal','Nose-to-tail cooking reduces food waste significantly.'],['terroir','n','the environmental effect on food flavour','Wine flavour is deeply influenced by terroir.']],
  colls:[['balanced diet','A balanced diet includes fruit, vegetables, and protein.'],['food waste','Reducing food waste is an environmental priority.'],['eating habits','Poor eating habits can lead to chronic disease.'],['food security','Climate change threatens global food security.'],['fast food','Fast food is convenient but often unhealthy.'],['home-cooked meal','Nothing beats a home-cooked meal after a long day.']]
},

// ── 7. HEALTH & MEDICINE ──
health: {
  b56:[['healthy','adj','in good physical condition','Eating vegetables keeps you healthy.'],['illness','n','a state of being unwell','Illness prevented her from attending the meeting.'],['exercise','n','physical activity for health','Regular exercise improves mental health.'],['medicine','n','a substance used to treat disease','The doctor prescribed some medicine.'],['symptom','n','a sign of illness','Fever is a common symptom of infection.'],['diet','n','the food a person regularly eats','A balanced diet is essential for good health.'],['recover','v','to get better after illness','She recovered quickly from the flu.'],['treatment','n','medical care for an illness or injury','The treatment was highly effective.']],
  b67:[['well-being','n','the state of being healthy and happy','Exercise contributes to overall well-being.'],['chronic','adj','lasting for a long time','Chronic diseases require ongoing management.'],['sedentary','adj','involving little physical movement','A sedentary lifestyle increases health risks.'],['obesity','n','the condition of being very overweight','Childhood obesity is a growing concern worldwide.'],['immune system','phr','the body\'s defence against disease','A strong immune system fights infection effectively.'],['diagnosis','n','identification of an illness','Early diagnosis greatly improves outcomes.'],['preventive','adj','designed to stop illness before it starts','Preventive healthcare saves lives and money.'],['nutritious','adj','full of substances the body needs','Nutritious school meals improve children\'s concentration.']],
  b78:[['holistic','adj','treating the whole person, not just symptoms','A holistic approach considers mental and physical health.'],['epidemic','n','widespread occurrence of a disease','The obesity epidemic affects many developed countries.'],['rehabilitation','n','restoring health after illness or injury','Rehabilitation after surgery takes several months.'],['mental resilience','phr','ability to cope with stress and adversity','Mental resilience is as important as physical fitness.'],['pharmaceutical','adj','relating to medicinal drugs','Pharmaceutical companies invest billions in research.'],['palliative','adj','relieving pain without curing the disease','Palliative care focuses on quality of life.'],['pathogen','n','a microorganism causing disease','Thorough handwashing removes most pathogens.'],['comorbidity','n','having two or more conditions simultaneously','Comorbidity complicates treatment planning.']],
  b89:[['psychosomatic','adj','physical symptoms caused by mental factors','Stress can trigger psychosomatic symptoms.'],['aetiology','n','the cause or origin of a disease','The aetiology of the condition remains unclear.'],['prophylaxis','n','action taken to prevent disease','Vaccination is a highly effective form of prophylaxis.'],['iatrogenic','adj','caused by medical treatment itself','Iatrogenic infections are a serious hospital concern.'],['epidemiology','n','the study of how diseases spread','Epidemiology informs public health policy decisions.'],['homeostasis','n','the body maintaining stable internal conditions','Homeostasis is essential for cellular function.'],['nosocomial','adj','originating in a hospital setting','Nosocomial infections affect thousands of patients yearly.'],['salutogenic','adj','focusing on factors that promote health','A salutogenic approach emphasises wellness over illness.']],
  colls:[['mental health','Mental health awareness has increased significantly.'],['healthcare system','The healthcare system needs more funding.'],['life expectancy','Life expectancy has risen in most countries.'],['public health','Public health campaigns reduce smoking rates.'],['side effects','All medications carry the risk of side effects.'],['medical breakthrough','The vaccine was a major medical breakthrough.']]
},

// ── 8. SPORTS & FITNESS ──
sports: {
  b56:[['exercise','n','physical activity for health or fitness','I try to exercise three times a week.'],['match','n','a competitive sporting event','We watched a football match on Saturday.'],['team','n','a group playing together','I play for the local basketball team.'],['competition','n','an event where people compete','She entered a swimming competition.'],['win','v','to achieve first place in a contest','Our team won the tournament last month.'],['practise','v','to do repeatedly to improve','I practise tennis every afternoon.'],['coach','n','a person who trains athletes','My coach helped me improve my technique.'],['score','n','the number of points in a game','The final score was three to one.']],
  b67:[['endurance','n','the ability to keep going for a long time','Marathon running requires great endurance.'],['opponent','n','a person you compete against','She defeated her opponent in straight sets.'],['spectator','n','someone who watches a sporting event','Thousands of spectators filled the stadium.'],['sportsmanship','n','fair and generous behaviour in sport','Good sportsmanship means respecting your opponent.'],['amateur','adj','doing something for enjoyment, not money','He plays football at an amateur level.'],['fitness regime','phr','a regular exercise programme','I follow a strict fitness regime.'],['stamina','n','physical or mental energy to sustain effort','Long-distance cycling demands tremendous stamina.'],['agility','n','ability to move quickly and easily','Agility is essential for badminton players.']],
  b78:[['physique','n','the form and size of a person\'s body','Swimmers tend to have a lean physique.'],['doping','n','using banned substances to enhance performance','Doping scandals have damaged the sport\'s reputation.'],['gruelling','adj','extremely tiring and demanding','The triathlon was absolutely gruelling.'],['prowess','n','great skill or bravery','His athletic prowess earned him a scholarship.'],['camaraderie','n','trust and friendship among teammates','The camaraderie in our team is wonderful.'],['marginal gains','phr','small improvements that add up to big results','The team\'s success was built on marginal gains.'],['rehab','n','recovery treatment after a sporting injury','She is in rehab for a knee injury.'],['sedentary lifestyle','phr','a way of life with little physical activity','A sedentary lifestyle is linked to heart disease.']],
  b89:[['proprioception','n','awareness of body position and movement','Proprioception is crucial for balance and coordination.'],['periodisation','n','dividing training into structured phases','Periodisation helps athletes peak at the right time.'],['biomechanics','n','the study of body movement in sport','Biomechanics research has optimised sprinting technique.'],['overtraining syndrome','phr','illness from excessive training','Overtraining syndrome can derail an entire season.'],['anaerobic threshold','phr','exercise intensity where lactic acid accumulates','Training at the anaerobic threshold improves race speed.'],['psychomotor','adj','relating to mental processes and movement','Psychomotor skills develop through repeated practice.'],['ergogenic','adj','enhancing physical performance','Caffeine is a widely used legal ergogenic aid.'],['VO2 max','phr','maximum oxygen uptake during exercise','Elite marathon runners have an exceptionally high VO2 max.']],
  colls:[['team spirit','Great team spirit carried us through the tournament.'],['keep fit','I go to the gym three times a week to keep fit.'],['level playing field','Fair rules create a level playing field for all athletes.'],['personal best','She set a new personal best in the 200 metres.'],['spectator sport','Football is the world\'s most popular spectator sport.'],['warm up','Always warm up properly before intense exercise.']]
},

// ── 9. TECHNOLOGY & DIGITAL ──
technology: {
  b56:[['device','n','an electronic tool or machine','I use my device for work and entertainment.'],['internet','n','a global computer network','The internet has changed how we communicate.'],['download','v','to transfer data to your device','I downloaded a new app yesterday.'],['screen','n','a flat display on an electronic device','Too much screen time is bad for your eyes.'],['password','n','a secret word for accessing an account','You should change your password regularly.'],['update','n','a new version of software','My phone needs a software update.'],['connect','v','to link to a network or device','I cannot connect to the Wi-Fi here.'],['search','v','to look for information online','I searched for the answer on the internet.']],
  b67:[['innovation','n','a new method, idea, or product','Technological innovation drives economic growth.'],['gadget','n','a small, clever electronic device','He loves buying the latest gadgets.'],['artificial intelligence','phr','computer systems mimicking human thought','Artificial intelligence is transforming healthcare.'],['data','n','information stored or processed digitally','Companies collect vast amounts of user data.'],['digital literacy','phr','the ability to use technology effectively','Digital literacy is essential in the modern workplace.'],['cybersecurity','n','protection of systems from digital attacks','Cybersecurity is a growing concern for businesses.'],['streaming','n','watching or listening to content online live','Streaming services have replaced traditional television.'],['cloud computing','phr','storing and accessing data on remote servers','Cloud computing allows access from anywhere in the world.']],
  b78:[['algorithm','n','a set of rules a computer follows to solve a problem','Social media algorithms control what content you see.'],['automation','n','using technology to perform tasks without humans','Automation is replacing many manufacturing jobs.'],['digital footprint','phr','the trail of data you leave online','Everyone should be aware of their digital footprint.'],['obsolescence','n','the state of becoming outdated','Planned obsolescence forces consumers to keep upgrading.'],['disruptive technology','phr','innovation that fundamentally changes an industry','Electric vehicles are a disruptive technology.'],['bandwidth','n','the data transmission capacity of a network','Limited bandwidth makes video conferencing frustrating.'],['biometric','adj','using unique body features for identification','Biometric scanning is increasingly used at airports.'],['augmented reality','phr','overlaying digital information on the physical world','Augmented reality has exciting applications in education.']],
  b89:[['singularity','n','the point when AI surpasses human intelligence','Some predict the technological singularity within decades.'],['quantum computing','phr','computing using quantum-mechanical phenomena','Quantum computing could break current encryption methods.'],['blockchain','n','a decentralised, tamper-proof digital ledger','Blockchain technology ensures transparent transactions.'],['Internet of Things','phr','everyday objects connected to the internet','The Internet of Things is making homes smarter.'],['deep learning','phr','AI that uses layered neural networks','Deep learning powers modern voice recognition systems.'],['digital divide','phr','the gap between those with and without internet access','The digital divide disproportionately affects rural communities.'],['technocracy','n','governance by technical experts','Some argue for technocracy over traditional politics.'],['transhumanism','n','using technology to enhance human capabilities','Transhumanism raises profound ethical questions.']],
  colls:[['social media','Social media has transformed personal communication.'],['cutting-edge technology','The lab uses cutting-edge technology for research.'],['digital age','Privacy is a major concern in the digital age.'],['tech-savvy','Younger generations tend to be more tech-savvy.'],['information overload','Information overload makes it hard to focus on what matters.'],['online privacy','Online privacy should be a fundamental right.']]
},

// ── 10. ENVIRONMENT & NATURE ──
environment: {
  b56:[['pollution','n','harmful substances in the environment','Air pollution is a serious problem in cities.'],['recycle','v','to convert waste into reusable material','We recycle paper, plastic, and glass at home.'],['climate','n','the typical weather conditions in an area','The climate here is warm and dry.'],['wildlife','n','wild animals and plants','We must protect wildlife from extinction.'],['energy','n','power used for heat, light, and machines','Solar energy is clean and renewable.'],['waste','n','unwanted or unusable material','We need to reduce household waste.'],['protect','v','to keep safe from harm or damage','Laws protect endangered species.'],['natural','adj','existing in nature, not made by humans','Natural resources are finite and must be conserved.']],
  b67:[['carbon footprint','phr','total greenhouse gases produced by an activity','Flying greatly increases your carbon footprint.'],['sustainability','n','using resources without depleting them for the future','Sustainability is now a key business goal.'],['deforestation','n','the clearing of forests on a large scale','Deforestation destroys countless animal habitats.'],['renewable','adj','able to be replenished naturally','Wind and solar are renewable energy sources.'],['biodiversity','n','the variety of plant and animal life','Biodiversity loss threatens entire ecosystems.'],['conservation','n','the protection of natural resources','Conservation efforts have saved many species from extinction.'],['greenhouse effect','phr','warming caused by gases trapping heat in the atmosphere','The greenhouse effect is intensifying due to fossil fuels.'],['ecosystem','n','a community of living organisms interacting together','Coral reefs are among the most fragile ecosystems.']],
  b78:[['ecological footprint','phr','human demand on the Earth\'s resources','Wealthy nations have the largest ecological footprint.'],['carbon neutral','phr','having zero net carbon emissions','The company aims to become carbon neutral by 2030.'],['desertification','n','the process of land becoming desert','Desertification threatens food production across Africa.'],['anthropogenic','adj','caused by human activity','Most recent climate change is anthropogenic in origin.'],['mitigation','n','the action of reducing severity or seriousness','Climate mitigation requires unprecedented global cooperation.'],['biodegradable','adj','able to decompose naturally','Biodegradable packaging reduces landfill waste.'],['habitat fragmentation','phr','splitting natural habitats into smaller isolated areas','Habitat fragmentation isolates animal populations dangerously.'],['carrying capacity','phr','the maximum population an environment can sustain','Earth\'s carrying capacity is fiercely debated.']],
  b89:[['tipping point','phr','the critical threshold of irreversible change','Scientists warn of imminent climate tipping points.'],['rewilding','n','restoring an area to its natural uncultivated state','Rewilding projects are reintroducing wolves to Scotland.'],['sequestration','n','capturing and storing atmospheric carbon dioxide','Carbon sequestration is a key mitigation strategy.'],['bioaccumulation','n','buildup of harmful chemicals in organisms','Bioaccumulation of mercury harms top predators.'],['albedo effect','phr','the reflectivity of the Earth\'s surface','Melting ice sheets reduce the planet\'s albedo effect.'],['ecocide','n','large-scale destruction of the natural environment','Campaigners want ecocide recognised as a crime.'],['phytoremediation','n','using plants to clean polluted soil or water','Phytoremediation offers a low-cost environmental cleanup method.'],['Anthropocene','n','the current era defined by human environmental impact','Many scientists say we now live in the Anthropocene.']],
  colls:[['climate change','Climate change is the greatest challenge of our generation.'],['carbon emissions','Governments must commit to reducing carbon emissions.'],['endangered species','The programme protects endangered species in the wild.'],['fossil fuels','We need to move away from fossil fuels.'],['natural disaster','The country is still recovering from the natural disaster.'],['renewable energy','Investment in renewable energy has doubled this decade.']]
},

// ── 11. FINANCE & ECONOMICS ──
finance: {
  b56:[['money','n','coins and notes used to buy things','I try to save money every month.'],['price','n','the amount something costs','The price of petrol has gone up.'],['cost','n','the amount paid for something','The cost of living keeps increasing.'],['earn','v','to receive money for work','She earns a good salary.'],['spend','v','to use money to buy things','I spend too much on coffee.'],['save','v','to keep money for future use','It is wise to save for retirement.'],['budget','n','a plan for how to use money','We need to stick to our monthly budget.'],['afford','v','to have enough money for something','I cannot afford a new car right now.']],
  b67:[['income','n','money received regularly for work or investments','The average household income has risen slightly.'],['investment','n','putting money into something for profit','Property investment can be very profitable.'],['inflation','n','a general increase in prices','Inflation is eroding purchasing power.'],['profit','n','money gained after costs are paid','The company reported record profits this year.'],['economic growth','phr','an increase in a country\'s output','Economic growth has slowed in recent quarters.'],['taxpayer','n','a person who pays taxes','Taxpayers fund public services.'],['mortgage','n','a loan for buying property','They took out a thirty-year mortgage.'],['debt','n','money owed to someone','Student debt is a growing problem.']],
  b78:[['fiscal policy','phr','government decisions on taxes and spending','Fiscal policy affects economic stability.'],['revenue','n','income, especially of a company or government','Tax revenue funds public infrastructure.'],['GDP','n','gross domestic product, the total economic output','GDP growth slowed to one point five percent.'],['austerity','n','strict reduction in government spending','Austerity measures led to public protests.'],['surplus','n','an amount left over after needs are met','The country ran a budget surplus last year.'],['microfinance','n','small loans to low-income entrepreneurs','Microfinance empowers communities in developing nations.'],['disposable income','phr','money left after taxes and essentials','Rising rents leave less disposable income for savings.'],['commodity','n','a raw material traded on markets','Oil is the world\'s most traded commodity.']],
  b89:[['quantitative easing','phr','central bank creating money to stimulate the economy','Quantitative easing was used extensively after the 2008 crisis.'],['stagflation','n','high inflation combined with economic stagnation','Stagflation poses a unique challenge for policymakers.'],['liquidity','n','the availability of cash or easily convertible assets','Liquidity dried up during the financial crisis.'],['arbitrage','n','profiting from price differences across markets','Arbitrage opportunities exist between international exchanges.'],['Gini coefficient','phr','a measure of income inequality','A high Gini coefficient indicates extreme inequality.'],['plutocracy','n','government by the wealthy','Critics call the system a plutocracy.'],['monetarism','n','economic theory focusing on money supply','Monetarism shaped policy in the 1980s.'],['securitisation','n','turning debt into tradable financial instruments','Securitisation of mortgages contributed to the 2008 crash.']],
  colls:[['cost of living','The cost of living has outpaced wage growth.'],['financial literacy','Financial literacy should be taught in schools.'],['economic downturn','Many businesses struggled during the economic downturn.'],['income inequality','Income inequality has widened in most developed countries.'],['foreign investment','Foreign investment boosts local job creation.'],['interest rate','The central bank raised the interest rate to curb inflation.']]
},

// ── 12. CRIME & LAW ──
crime: {
  b56:[['crime','n','an illegal act','Crime rates have dropped in recent years.'],['steal','v','to take something without permission','Someone stole my bicycle last week.'],['police','n','the official force maintaining public order','The police arrived within minutes.'],['prison','n','a place where criminals are held','He was sentenced to five years in prison.'],['law','n','a system of rules enforced by authority','Everyone must obey the law.'],['punishment','n','a penalty for breaking a rule or law','The punishment should fit the crime.'],['safe','adj','free from danger or risk','This neighbourhood is very safe.'],['victim','n','a person harmed by a crime','The victim reported the incident immediately.']],
  b67:[['offender','n','a person who commits a crime','Young offenders need rehabilitation, not just punishment.'],['deterrent','n','something that discourages an action','Longer sentences may act as a deterrent.'],['rehabilitation','n','helping someone return to a normal life','Rehabilitation programmes reduce reoffending rates.'],['juvenile','adj','relating to young people under eighteen','Juvenile crime requires a specialised approach.'],['fraud','n','the crime of deceiving people for financial gain','Online fraud is becoming increasingly common.'],['vandalism','n','deliberate destruction of property','Vandalism costs local councils thousands each year.'],['surveillance','n','close watching, especially by cameras','CCTV surveillance helps deter street crime.'],['penalty','n','a punishment imposed for breaking the law','The penalty for drunk driving has increased.']],
  b78:[['recidivism','n','the tendency to reoffend after punishment','Recidivism rates remain stubbornly high in many countries.'],['incarceration','n','the state of being imprisoned','Mass incarceration has not significantly reduced crime.'],['white-collar crime','phr','non-violent financial crime','White-collar crime costs economies billions annually.'],['mitigating circumstances','phr','factors reducing the severity of blame','The court considered the mitigating circumstances carefully.'],['restorative justice','phr','repairing harm through offender-victim dialogue','Restorative justice brings closure to victims.'],['penal system','phr','the system of criminal punishment','Reform of the penal system is long overdue.'],['custodial sentence','phr','a sentence served in prison','He received a custodial sentence of three years.'],['culpable','adj','deserving of blame for a wrongdoing','The company was found culpable for the negligence.']],
  b89:[['jurisprudence','n','the theory and philosophy of law','Jurisprudence explores the foundations of legal justice.'],['extenuating','adj','partially excusing an offence','Extenuating factors influenced the judge\'s final decision.'],['probation','n','supervised release instead of prison','She was placed on probation for eighteen months.'],['clemency','n','mercy or leniency towards an offender','The governor granted clemency to the prisoner.'],['malfeasance','n','illegal or dishonest conduct by an official','The mayor was charged with malfeasance in office.'],['habeas corpus','phr','the right to not be held without trial','Habeas corpus is a cornerstone of individual liberty.'],['plea bargain','phr','agreeing to plead guilty for a lighter sentence','The defendant accepted a plea bargain.'],['recidivist','n','a person who repeatedly commits crimes','The programme offers intensive support for recidivists.']],
  colls:[['crime rate','The crime rate has fallen for three consecutive years.'],['commit a crime','He committed a crime and faced the consequences.'],['law enforcement','Law enforcement agencies are working together on the case.'],['criminal record','A criminal record can affect future job prospects.'],['community service','The judge ordered two hundred hours of community service.'],['zero tolerance','The school has a zero tolerance policy on bullying.']]
},

// ── 13. MEDIA & NEWS ──
media: {
  b56:[['news','n','newly received information about events','I watch the news every evening.'],['social media','phr','websites and apps for sharing content','Social media connects people across the world.'],['report','n','an account of an event or investigation','The journalist wrote a detailed report.'],['article','n','a piece of writing in a newspaper or online','I read an interesting article about climate change.'],['advertise','v','to promote a product or service publicly','Companies advertise heavily during the World Cup.'],['broadcast','v','to transmit a programme by radio or TV','The match was broadcast live to millions.'],['headline','n','the title of a news story','The headline immediately caught my attention.'],['journalist','n','a person who reports news','The journalist investigated the corruption scandal.']],
  b67:[['biased','adj','unfairly favouring one side over another','Some news outlets are politically biased.'],['censorship','n','the suppression of speech or information','Censorship limits freedom of expression.'],['editorial','n','a newspaper article expressing the editor\'s opinion','The editorial criticised the government\'s policy.'],['tabloid','n','a newspaper focusing on sensational stories','Tabloid newspapers often exaggerate the truth.'],['press conference','phr','a meeting where information is given to reporters','The president held a press conference at noon.'],['media coverage','phr','the extent of reporting on a topic','Media coverage of the election was extensive.'],['breaking news','phr','newly received urgent information','Breaking news interrupted the regular programme.'],['circulation','n','the number of copies of a newspaper sold','The newspaper\'s circulation has declined sharply.']],
  b78:[['misinformation','n','false information spread unintentionally','Misinformation spreads rapidly on social media.'],['disinformation','n','false information spread deliberately','State-sponsored disinformation undermines public trust.'],['sensationalism','n','exaggerating news to attract attention','Sensationalism prioritises clicks over accuracy.'],['media literacy','phr','the ability to critically analyse media messages','Schools must teach media literacy from an early age.'],['echo chamber','phr','an environment reinforcing existing beliefs','Social media algorithms create echo chambers.'],['propaganda','n','biased information used to promote a viewpoint','Propaganda was widely used during both world wars.'],['whistleblower','n','a person who exposes wrongdoing','The whistleblower revealed widespread financial fraud.'],['defamation','n','damaging someone\'s reputation with false statements','The celebrity sued the tabloid for defamation.']],
  b89:[['fourth estate','phr','the press as a powerful political force','The fourth estate plays a vital role in democratic accountability.'],['manufactured consent','phr','media shaping public opinion for the powerful','Chomsky theorised about the manufacture of consent.'],['infotainment','n','news presented as entertainment','Infotainment blurs the boundary between fact and fun.'],['yellow journalism','phr','irresponsible sensational reporting','Yellow journalism sacrifices truth for readership.'],['astroturfing','n','creating fake grassroots campaigns','Corporate astroturfing simulates public support.'],['churnalism','n','journalism that recycles press releases','Churnalism has reduced the quality of investigative reporting.'],['citizen journalism','phr','reporting by ordinary members of the public','Smartphones have enabled the rise of citizen journalism.'],['Overton window','phr','the range of ideas acceptable in public discourse','Social media has shifted the Overton window dramatically.']],
  colls:[['mass media','Mass media shapes public opinion on key issues.'],['press freedom','Press freedom is a pillar of democracy.'],['fake news','Fake news poses a serious threat to informed debate.'],['media outlet','The story was covered by every major media outlet.'],['public opinion','Media has an enormous influence on public opinion.'],['news coverage','News coverage of the disaster prompted global donations.']]
},

// ── 14. GOVERNANCE & POLITICS ──
governance: {
  b56:[['government','n','the group of people who rule a country','The government announced new policies today.'],['law','n','a rule made by the government','A new law was passed to reduce pollution.'],['election','n','the process of choosing leaders by voting','The next general election is in two years.'],['vote','v','to formally choose a candidate or option','Citizens over eighteen can vote in elections.'],['citizen','n','a person who belongs to a country','Every citizen has rights and responsibilities.'],['leader','n','a person who guides or commands a group','A good leader inspires trust and confidence.'],['policy','n','a plan of action adopted by a government','The education policy was reformed last year.'],['rule','n','an official regulation or principle','Everyone must follow the rules.']],
  b67:[['democracy','n','a system of government by elected representatives','Democracy depends on an informed electorate.'],['parliament','n','the body that makes laws in a country','Parliament debated the new healthcare bill.'],['legislation','n','laws collectively or the process of making them','New legislation was introduced to fight cybercrime.'],['reform','n','a change made to improve a system','Education reform is urgently needed.'],['bureaucracy','n','a complex system of administration','Excessive bureaucracy slows down decision-making.'],['campaign','n','an organised effort to achieve a political goal','The campaign focused on environmental issues.'],['constitutional','adj','relating to a country\'s constitution','Freedom of speech is a constitutional right.'],['opposition','n','the political parties not in power','The opposition criticised the budget proposals.']],
  b78:[['authoritarian','adj','enforcing strict obedience to authority','Authoritarian regimes restrict civil liberties.'],['suffrage','n','the right to vote in elections','Universal suffrage was achieved after decades of struggle.'],['bilateral','adj','involving two countries or parties','The two nations signed a bilateral trade agreement.'],['geopolitical','adj','relating to politics among nations','Geopolitical tensions are rising in the region.'],['referendum','n','a vote by citizens on a single issue','A referendum was held on constitutional reform.'],['accountability','n','being responsible for actions and decisions','Government accountability requires transparent institutions.'],['diplomacy','n','managing international relations','Diplomacy averted a potential military conflict.'],['sovereignty','n','supreme authority of a state to govern itself','National sovereignty is a key principle of international law.']],
  b89:[['oligarchy','n','rule by a small group of powerful people','Critics describe the system as an oligarchy.'],['kleptocracy','n','government by corrupt leaders who steal from the state','The country suffered under a kleptocracy for decades.'],['realpolitik','n','politics based on practical rather than moral considerations','Realpolitik often overrides idealistic foreign policy.'],['supranational','adj','transcending national boundaries or governments','The EU is a supranational organisation.'],['devolution','n','transferring powers from central to local government','Devolution gave regions greater self-governance.'],['autocracy','n','government by one person with absolute power','Autocracy suppresses dissent and free media.'],['technocracy','n','government by technical experts rather than politicians','Some propose technocracy as a more efficient system.'],['Westphalian','adj','relating to the modern system of sovereign states','The Westphalian model defines international relations.']],
  colls:[['foreign policy','The country\'s foreign policy shifted under the new administration.'],['political stability','Political stability attracts foreign investment.'],['public sector','Public sector workers went on strike over pay.'],['civil liberties','Civil liberties must be protected even in times of crisis.'],['human rights','Human rights should be universal and non-negotiable.'],['welfare state','The welfare state provides a safety net for the vulnerable.']]
},

// ── 15. SOCIETY & GLOBALISATION ──
society: {
  b56:[['community','n','a group of people living in the same area','Our community organised a clean-up day.'],['culture','n','the customs and beliefs of a group','Every culture has its own unique traditions.'],['tradition','n','a custom passed down through generations','The tradition of decorating trees dates back centuries.'],['society','n','people living together in an organised way','Society has changed dramatically in the last fifty years.'],['belong','v','to be a member of a group','Everyone wants to belong to a community.'],['share','v','to give part of something to others','We should share resources fairly.'],['custom','n','a traditional practice or behaviour','The custom of gift-giving is widespread.'],['group','n','a number of people together','A group of volunteers cleaned the park.']],
  b67:[['multicultural','adj','consisting of people from many cultural backgrounds','Australia is a multicultural society.'],['diverse','adj','showing variety and difference','The city has a diverse population.'],['inequality','n','unfair differences between groups','Income inequality has widened globally.'],['prejudice','n','unfair opinions formed without knowledge','Education helps reduce racial prejudice.'],['immigrant','n','a person who moves to another country','Immigrants contribute significantly to the economy.'],['volunteer','n','a person who works without pay','Volunteers helped rebuild after the flood.'],['tolerance','n','willingness to accept different views','Tolerance is essential in a diverse society.'],['charity','n','an organisation that helps those in need','The charity provides meals to homeless people.']],
  b78:[['assimilation','n','the process of absorbing into a culture','Full assimilation takes more than one generation.'],['marginalised','adj','treated as insignificant by society','Marginalised communities often lack access to healthcare.'],['demographic','adj','relating to population statistics','Demographic shifts are reshaping the workforce.'],['social cohesion','phr','the bonds that hold a society together','Social cohesion weakens when inequality grows.'],['civic duty','phr','a citizen\'s responsibility to society','Voting is considered a civic duty.'],['egalitarian','adj','believing in equal rights for all','Sweden is known for its egalitarian values.'],['xenophobia','n','fear or hatred of foreigners','Xenophobia often increases during economic downturns.'],['diaspora','n','people dispersed from their homeland','The Irish diaspora spans the globe.']],
  b89:[['intersectionality','n','interconnected nature of social categorisations','Intersectionality reveals how race, class, and gender overlap.'],['hegemonic','adj','dominant and ruling over others','Hegemonic cultural norms marginalise minorities.'],['subaltern','adj','of lower social status','Subaltern voices are often excluded from official narratives.'],['cosmopolitanism','n','the idea that all people share a moral community','Cosmopolitanism promotes global solidarity over nationalism.'],['cultural relativism','phr','judging a culture by its own standards','Cultural relativism challenges universal moral judgements.'],['ethnocentrism','n','evaluating others by your own cultural norms','Ethnocentrism can lead to prejudice and discrimination.'],['social stratification','phr','hierarchical arrangement of people in society','Social stratification determines access to resources.'],['anomie','n','lack of social or moral standards in a society','Rapid change can produce a sense of anomie.']],
  colls:[['social mobility','Education is a key driver of social mobility.'],['cultural diversity','Cultural diversity enriches the fabric of society.'],['social welfare','The government expanded social welfare programmes.'],['civil society','A strong civil society holds governments to account.'],['community service','Community service builds empathy and social awareness.'],['standard of living','The standard of living has improved in most regions.']]
},

// ── 16. CULTURE & HERITAGE ──
culture: {
  b56:[['festival','n','an organised series of events or celebrations','The music festival attracted thousands of visitors.'],['celebrate','v','to mark a special occasion with enjoyment','We celebrate New Year with fireworks.'],['costume','n','clothes worn for a special occasion','Children wore traditional costumes for the parade.'],['tradition','n','a belief or custom passed through generations','The tradition has been kept alive for centuries.'],['music','n','vocal or instrumental sounds combined artistically','Music brings people from different backgrounds together.'],['dance','n','rhythmic movement to music','Traditional dance is performed at every festival.'],['ceremony','n','a formal event marking a special occasion','The wedding ceremony was beautiful.'],['symbol','n','something representing an idea or quality','The dove is a symbol of peace.']],
  b67:[['heritage','n','valued traditions and history of a group','Protecting cultural heritage is everyone\'s responsibility.'],['ritual','n','a ceremony or series of acts performed regularly','Morning tea is almost a daily ritual in Japan.'],['folklore','n','the traditional stories and beliefs of a community','Folklore reflects a society\'s values and fears.'],['indigenous','adj','originating naturally in a particular place','Indigenous peoples have unique cultural knowledge.'],['multicultural','adj','relating to many different cultures','The city\'s multicultural character is its strength.'],['preservation','n','keeping something in its original state','The preservation of ancient monuments requires funding.'],['authentic','adj','genuine and true to origins','Tourists seek authentic cultural experiences.'],['ritual','n','a ceremonial act or series of acts','The harvest ritual dates back a thousand years.']],
  b78:[['intangible heritage','phr','non-physical cultural practices','Music and dance are forms of intangible heritage.'],['cultural identity','phr','the feeling of belonging to a culture','Globalisation both threatens and enriches cultural identity.'],['pluralism','n','the coexistence of diverse groups in society','Cultural pluralism strengthens democratic societies.'],['cultural exchange','phr','sharing ideas and traditions between cultures','Student exchange programmes promote cultural exchange.'],['iconography','n','the use of images and symbols in art','Religious iconography varies across traditions.'],['vernacular','adj','relating to the language or culture of ordinary people','Vernacular architecture reflects local climate and materials.'],['patronage','n','financial support for the arts','Royal patronage sustained many great artists.'],['curator','n','a person who manages a museum or collection','The curator organised a stunning exhibition.']],
  b89:[['syncretism','n','the merging of different cultural or religious traditions','Syncretism is visible in many Latin American festivals.'],['cultural hegemony','phr','dominance of one culture over others','Hollywood contributes to Western cultural hegemony.'],['postcolonial','adj','relating to the period after colonial rule','Postcolonial literature explores identity and displacement.'],['semiotics','n','the study of signs and symbols','Semiotics helps us decode cultural messages.'],['liminality','n','the quality of being between two states','Festival time is a period of liminality and transformation.'],['cultural capital','phr','social assets beyond money, like education and intellect','Cultural capital influences social mobility.'],['zeitgeist','n','the defining spirit of a particular era','The protest movement captured the zeitgeist of a generation.'],['ethnocentric','adj','judging other cultures by the standards of one\'s own','Ethnocentric attitudes can hinder intercultural understanding.']],
  colls:[['cultural heritage','UNESCO protects sites of outstanding cultural heritage.'],['cultural shock','Many travellers experience cultural shock in the first week.'],['folk tradition','The folk tradition of storytelling continues in rural areas.'],['national identity','Language is a key part of national identity.'],['performing arts','The government increased funding for the performing arts.'],['cultural awareness','Cultural awareness training benefits international businesses.']]
},

// ── 17. SCIENCE & RESEARCH ──
science: {
  b56:[['experiment','n','a test done to discover something','The students did an experiment in the lab.'],['discover','v','to find something for the first time','Scientists discovered a new species of fish.'],['research','n','the study of a subject to find new information','The university funds medical research.'],['theory','n','an idea used to explain something','The theory of evolution changed biology.'],['data','n','facts and statistics collected for analysis','The data supports the hypothesis.'],['evidence','n','facts proving something is true','There is strong evidence of climate change.'],['method','n','a way of doing something systematically','The scientific method requires careful observation.'],['result','n','the outcome of an experiment or study','The results were published in a leading journal.']],
  b67:[['hypothesis','n','a proposed explanation to be tested','The researchers tested their hypothesis over two years.'],['observation','n','carefully watching and recording something','Observation is the first step in the scientific method.'],['laboratory','n','a room equipped for scientific experiments','The new laboratory has state-of-the-art equipment.'],['variable','n','a factor that can change in an experiment','Temperature was the independent variable in the study.'],['analysis','n','detailed examination of data','Data analysis revealed a significant trend.'],['peer review','phr','evaluation of research by experts in the field','Peer review ensures the quality of published research.'],['breakthrough','n','an important discovery or development','The vaccine was a major scientific breakthrough.'],['specimen','n','a sample used for scientific study','The specimen was preserved in formaldehyde.']],
  b78:[['empirical','adj','based on observation and experiment','Empirical evidence supports the theory.'],['paradigm','n','a typical example or dominant framework','The discovery led to a paradigm shift in physics.'],['correlation','n','a relationship between two variables','There is a strong correlation between poverty and poor health.'],['replicability','n','the ability to repeat an experiment with the same results','Replicability is a cornerstone of scientific credibility.'],['interdisciplinary','adj','involving more than one branch of knowledge','Climate research requires an interdisciplinary approach.'],['methodology','n','the system of methods used in a study','The methodology section describes how the study was conducted.'],['quantitative','adj','relating to measurement and numbers','Quantitative data provides statistical evidence.'],['qualitative','adj','relating to quality and description','Qualitative research explores people\'s experiences in depth.']],
  b89:[['falsifiability','n','the ability of a theory to be proven wrong','Falsifiability is a key criterion in scientific philosophy.'],['stochastic','adj','randomly determined, involving probability','The model uses stochastic variables to simulate outcomes.'],['ontological','adj','relating to the nature of being and existence','Ontological debates underpin many scientific questions.'],['meta-analysis','n','a statistical analysis combining multiple studies','The meta-analysis confirmed the drug\'s effectiveness.'],['epistemological','adj','relating to the study of knowledge','Epistemological challenges arise in social science research.'],['reductionism','n','explaining complex phenomena through simpler components','Reductionism is both a strength and a limitation of science.'],['heuristic','n','a practical problem-solving approach','Scientists often use heuristic models as starting points.'],['axiom','n','a statement accepted as true without proof','Euclid\'s axioms form the foundation of geometry.']],
  colls:[['scientific method','The scientific method requires rigorous testing.'],['peer-reviewed journal','The paper was published in a peer-reviewed journal.'],['field research','Field research provides data that lab work cannot.'],['research findings','The research findings support earlier studies.'],['clinical trial','The drug passed a large-scale clinical trial.'],['body of evidence','A growing body of evidence links diet to mental health.']]
},

// ── 18. ARTS & ENTERTAINMENT ──
arts: {
  b56:[['painting','n','a picture made with paint','The painting hangs in the national gallery.'],['song','n','a piece of music with words','That song always makes me happy.'],['performance','n','an act of presenting entertainment','The theatre performance was outstanding.'],['museum','n','a building displaying historical or artistic objects','We visited the science museum on Saturday.'],['gallery','n','a room or building for displaying art','The gallery held an exhibition of modern sculpture.'],['creative','adj','having the ability to produce original ideas','She is a very creative writer.'],['talent','n','a natural ability or skill','He has a real talent for drawing.'],['stage','n','a raised platform for performances','The singer walked onto the stage confidently.']],
  b67:[['contemporary','adj','belonging to the present time','Contemporary art can be provocative and challenging.'],['exhibition','n','a public display of art or items','The exhibition featured works by local artists.'],['composition','n','the arrangement of elements in a work of art','The composition of the photograph was perfect.'],['inspire','v','to fill someone with creative motivation','The landscape inspired many famous painters.'],['sculpture','n','a three-dimensional work of art','The bronze sculpture stands in the park.'],['genre','n','a category of art, music, or literature','Horror is my favourite film genre.'],['masterpiece','n','an outstanding work of art','The Mona Lisa is considered a masterpiece.'],['artistic','adj','having creative skill or talent','Her artistic vision transformed the gallery.']],
  b78:[['avant-garde','adj','new and experimental in art','The avant-garde movement challenged traditional forms.'],['aesthetic','adj','concerned with beauty and artistic taste','The building has a minimalist aesthetic.'],['abstract','adj','art that does not depict reality directly','Abstract art focuses on colour and form.'],['retrospective','n','an exhibition reviewing an artist\'s career','The museum held a retrospective of her work.'],['medium','n','the material or form used in art','Oil paint was his preferred artistic medium.'],['patronage','n','financial support for artists or the arts','Government patronage helps sustain cultural institutions.'],['oeuvre','n','the complete works of an artist','His oeuvre spans fifty years of painting.'],['ephemeral','adj','lasting for a very short time','Street art is often deliberately ephemeral.']],
  b89:[['verisimilitude','n','the appearance of being true or real','The novel\'s verisimilitude made it deeply engaging.'],['leitmotif','n','a recurring theme in a work of art or music','The leitmotif of loss runs through his entire oeuvre.'],['pastiche','n','a work imitating the style of another','The film is a pastiche of classic Hollywood noir.'],['chiaroscuro','n','the use of strong contrasts of light and dark','Caravaggio mastered the technique of chiaroscuro.'],['virtuosity','n','exceptional skill in performance','The pianist\'s virtuosity left the audience speechless.'],['magnum opus','phr','an artist\'s greatest work','The symphony is widely regarded as his magnum opus.'],['iconoclasm','n','the rejection of established artistic conventions','Punk embodied musical iconoclasm.'],['palimpsest','n','something reused or altered retaining traces of earlier forms','The city is a palimpsest of architectural styles.']],
  colls:[['work of art','The cathedral is a true work of art.'],['performing arts','Government funding for the performing arts has been cut.'],['visual arts','Visual arts include painting, sculpture, and photography.'],['artistic expression','Art galleries protect freedom of artistic expression.'],['cultural event','The cultural event attracted visitors from across the region.'],['box office','The film performed well at the box office.']]
},

// ── 19. PSYCHOLOGY & BEHAVIOUR ──
psychology: {
  b56:[['feeling','n','an emotional state','I have a feeling of excitement about the trip.'],['emotion','n','a strong feeling such as joy or anger','It is healthy to express your emotions.'],['stress','n','mental or emotional tension','Work-related stress affects millions of people.'],['happy','adj','feeling pleasure or contentment','Spending time outdoors makes me happy.'],['worry','v','to feel anxious about something','I worry about the future sometimes.'],['confidence','n','the feeling of believing in yourself','Public speaking builds confidence.'],['memory','n','the ability to remember things','She has an excellent memory for names.'],['behaviour','n','the way a person acts','Good behaviour is rewarded in the classroom.']],
  b67:[['motivation','n','the reason for acting in a particular way','Intrinsic motivation leads to deeper learning.'],['anxiety','n','a feeling of worry and unease','Test anxiety is common among students.'],['personality','n','the combination of traits that define a person','Personality affects how we interact with others.'],['peer pressure','phr','influence from people in your social group','Teenagers are especially vulnerable to peer pressure.'],['self-esteem','n','confidence in one\'s own worth','High self-esteem helps children face challenges.'],['cognitive','adj','relating to mental processes','Cognitive development is rapid in early childhood.'],['therapy','n','treatment for mental or emotional problems','Therapy helped her overcome anxiety.'],['resilience','n','the ability to recover from adversity','Resilience is developed through facing and overcoming challenges.']],
  b78:[['intrinsic','adj','belonging naturally, coming from within','Intrinsic motivation is more sustainable than rewards.'],['subconscious','adj','below the level of conscious awareness','Many decisions are influenced by subconscious biases.'],['cognitive bias','phr','a systematic error in thinking','Confirmation bias is a common cognitive bias.'],['neuroplasticity','n','the brain\'s ability to reorganise itself','Neuroplasticity means the brain can change at any age.'],['conditioning','n','training behaviour through repeated association','Classical conditioning was demonstrated by Pavlov.'],['attachment','n','an emotional bond between people','Secure attachment in infancy predicts healthy relationships.'],['catharsis','n','the release of strong emotions','Writing can provide a sense of catharsis.'],['psychosomatic','adj','physical symptoms caused by mental factors','Chronic stress can produce psychosomatic illness.']],
  b89:[['metacognition','n','awareness and understanding of one\'s own thought processes','Metacognition helps students learn more effectively.'],['psychodynamic','adj','relating to unconscious drives and past experiences','Psychodynamic therapy explores early childhood experiences.'],['operant conditioning','phr','learning through consequences','Operant conditioning shapes behaviour through rewards and punishments.'],['ego depletion','phr','reduced willpower after sustained mental effort','Ego depletion explains why we make poor choices when tired.'],['schema theory','phr','the idea that we use mental frameworks to interpret the world','Schema theory helps explain reading comprehension.'],['existential','adj','relating to human existence and meaning','An existential crisis can lead to profound personal growth.'],['Maslow\'s hierarchy','phr','a theory ranking human needs from basic to self-actualisation','Maslow\'s hierarchy places belonging above physiological needs.'],['heuristic','n','a mental shortcut for quick decisions','Heuristics are efficient but can lead to errors.']],
  colls:[['mental health','Employers must prioritise staff mental health.'],['emotional intelligence','Emotional intelligence is valued in leadership roles.'],['body language','Body language often reveals more than words.'],['coping mechanism','Exercise is a healthy coping mechanism for stress.'],['self-awareness','Self-awareness is the first step to personal growth.'],['attention span','Social media may be shortening our attention span.']]
},

// ── 20. GENERAL / DEFAULT ──
general: {
  b56:[['important','adj','of great value or significance','Education is very important for everyone.'],['improve','v','to make or become better','I want to improve my English.'],['benefit','n','an advantage or positive result','Regular exercise has many benefits.'],['common','adj','happening frequently or widely','This is a very common mistake.'],['method','n','a particular way of doing something','This method is very effective.'],['opportunity','n','a chance to do something positive','Education provides many opportunities.'],['challenge','n','a difficult but worthwhile task','Learning a new language is a real challenge.'],['develop','v','to grow or become more advanced','Skills develop through practice and experience.']],
  b67:[['significant','adj','large enough to be important or noticeable','There has been a significant improvement.'],['contribute','v','to give something towards a common purpose','Volunteers contribute to community development.'],['perspective','n','a particular way of thinking about something','We should consider different perspectives.'],['essential','adj','absolutely necessary and important','Clean water is essential for survival.'],['consequence','n','a result or effect of an action','Pollution has serious consequences for health.'],['tendency','n','an inclination towards a particular behaviour','There is a growing tendency to work remotely.'],['alternative','n','another choice or option','Public transport is an alternative to driving.'],['emphasis','n','special importance given to something','There is increasing emphasis on sustainability.']],
  b78:[['unprecedented','adj','never done or known before','The pandemic caused an unprecedented global crisis.'],['paradigm','n','a model or pattern of thinking','This discovery shifted the scientific paradigm.'],['disparity','n','a great difference, especially an unfair one','Income disparity is growing worldwide.'],['alleviate','v','to make a problem less severe','Aid programmes alleviate poverty.'],['catalyst','n','something that causes important change','The invention was a catalyst for industrial growth.'],['nuanced','adj','having subtle and complex differences','The issue requires a nuanced understanding.'],['exacerbate','v','to make a problem worse','Climate change exacerbates food insecurity.'],['contentious','adj','causing disagreement or argument','Immigration is a contentious political topic.']],
  b89:[['paradigm shift','phr','a fundamental change in approach or thinking','Remote work represents a paradigm shift in employment.'],['dichotomy','n','a division into two completely different things','The urban-rural dichotomy is often oversimplified.'],['ameliorate','v','to make something bad better','Education can ameliorate social inequality.'],['ubiquitous','adj','found everywhere','Smartphones are now ubiquitous in daily life.'],['axiom','n','a statement accepted as self-evidently true','Equality of opportunity is a widely held social axiom.'],['zeitgeist','n','the spirit or mood of a particular period','Sustainability defines the zeitgeist of this decade.'],['hegemony','n','dominance of one group over others','Cultural hegemony shapes public discourse.'],['epistemological','adj','relating to the theory of knowledge itself','Epistemological debates underpin modern scientific inquiry.']],
  colls:[['pros and cons','We should consider the pros and cons carefully.'],['in the long run','Education pays off in the long run.'],['play a role','Technology plays a major role in modern education.'],['raise awareness','The campaign aims to raise awareness of the issue.'],['take measures','Governments must take measures to reduce inequality.'],['have an impact','Tourism can have both a positive and negative impact.']]
},

}; // end POOLS

/* ═══════════════════════════════════════════════════════════════════
   KEYWORD → POOL MAPPING
   ═══════════════════════════════════════════════════════════════════ */
const KEYWORD_MAP = [
  [['family','child','parent','marriage','relationship','ageing','generation','sibling','domestic','gender equal'], 'family'],
  [['work','career','employ','labour','job','interview','freelanc','occupation','profession','automation & ai'], 'work'],
  [['educ','learn','school','study','academ','tutor','literacy','curriculum','campus','university','enrol','course','essay','report writing','exam','revision','note-taking','study skill','lecture'], 'education'],
  [['city','cities','urban','town','village','suburb','hous','architectur','building','accommodation','planning','neighbour','communit','moving','relocation'], 'places'],
  [['travel','tourism','holiday','booking','reservation','flight','backpack','destination','excursion','hospitality','field trip'], 'travel'],
  [['food','cook','cuisine','restaurant','dining','nutrition','diet','meal','kitchen','ingredient','farm','agricultur','organic','eating'], 'food'],
  [['health','medic','illness','disease','fitness','well-being','hospital','clinic','patient','surgery','mental health','sleep','relaxation','gym','nutrition & diet'], 'health'],
  [['sport','exercise','match','competition','athlet','fitness','recreation','soccer','swim','run','dance','movement'], 'sports'],
  [['technol','digital','internet','comput','cyber','software','app','online','ai','robot','automat','innovat','gadget','virtual','IT support'], 'technology'],
  [['environment','climate','nature','pollution','wildlife','ecolog','conserv','weather','season','renewable','sustainab','energy','ocean','water','river','marine','sea','geolog','meteorolog'], 'environment'],
  [['financ','econom','money','trade','poverty','inequal','bank','budget','invest','tax','price','consumer','shopping','insurance','fashion industry'], 'finance'],
  [['crime','law','prison','police','justice','punish','legal','court','theft','fraud','rule'], 'crime'],
  [['media','news','journal','broadcast','advertis','press','censor','social media'], 'media'],
  [['govern','politic','democra','parliament','elect','vote','polic','diplomac','war','peace','international law'], 'governance'],
  [['societ','social','communit','globali','immigra','migrat','volunteer','charit','equality','multicultural','diversity','welfare','civic'], 'society'],
  [['cultur','heritage','tradition','festival','celebrat','ceremon','costum','folklor','indigenous','ritual','gift'], 'culture'],
  [['scien','research','biolog','physic','chemist','genetic','DNA','laborator','astronom','space','planet','palaeontol','geolog','botan','zoolog','engineer','mathemat','statistic','ecology','ecosystem'], 'science'],
  [['art','music','film','cinema','paint','sculpt','theatre','literatur','book','reading','photo','gallery','museum','visual','perform','song','movie','creative','television'], 'arts'],
  [['psycholog','behaviour','brain','mental','emotion','feeling','stress','anxiety','motivation','cognitive','neurosci','personality','confidence','patience','dream','ambition','success','achievement','happiness','manners','etiquette','role model'], 'psychology'],
  [['language','linguist','communicat','speech','presentation','speaking'], 'education'],
  [['colour','prefer','map','direction','noise','quiet','public transport','vehicle','driving','transport','traffic','commut','logistic'], 'places'],
  [['cloth','style','fashion & clothing','clothes'], 'finance'],
  [['seminar','tutorial','teamwork','group project','career guidance','counselling','orientation','workshop','training'], 'education'],
  [['animal','pet','wildlife','zoolog','species','insect'], 'environment'],
  [['hobby','hobbies','leisure','free time','spare time','pastime'], 'arts'],
  [['time manage','productiv','schedule','organis'], 'work'],
  [['ethic','moral','philosoph'], 'governance'],
  [['histor','archaeol','civilisation','antiquit','fossil','palaeontol'], 'culture'],
  [['geograph','landscape','demograph','popul','migrat'], 'society'],
  [['support service','student support'], 'education'],
];

function matchPool(tag) {
  const t = tag.toLowerCase();
  for (const [keywords, poolName] of KEYWORD_MAP) {
    if (keywords.some(k => t.includes(k))) return POOLS[poolName];
  }
  return POOLS.general;
}

/* ═══════════════════════════════════════════════════════════════════
   200 TOPIC DEFINITIONS
   ═══════════════════════════════════════════════════════════════════ */
const TOPIC_DEFS = [
  // ── SPEAKING (50) ──
  ...[
    'Family & Relationships','Work & Career','Education & Learning','Hometown & Cities','Travel & Tourism',
    'Food & Cooking','Health & Wellbeing','Sports & Fitness','Technology & Gadgets','Environment & Nature',
    'Weather & Seasons','Shopping & Consumer Habits','Money & Finance','Transport & Commuting','Housing & Architecture',
    'Media & News','Art & Creativity','Music & Entertainment','Language & Communication','Fashion & Clothing',
    'Festivals & Celebrations','Books & Reading','Science & Research','Government & Politics','Globalisation & Trade',
    'Ageing & Generations','Friendship & Social Life','Animals & Pets','Agriculture & Farming','Space & Astronomy',
    'History & Heritage','Psychology & Behaviour','Water & Rivers','Energy & Resources','Photography & Visual Arts',
    'Movies & Television','Hobbies & Leisure','Time Management','Volunteering & Charity','Childhood Memories',
    'Daily Routines & Habits','Dreams & Ambitions','Manners & Etiquette','Neighbours & Community','Public Speaking',
    'Role Models & Influence','Sleep & Relaxation','Success & Achievement','Tourism & Hospitality','Urban vs Rural Life'
  ].map(tag => ({ tag, mod: 'speaking' })),
  // ── WRITING (50) ──
  ...[
    'Education Systems','Technology Impact on Society','Environment & Pollution','Healthcare & Medicine','Crime & Punishment',
    'Government & Policy','Media & Journalism','Globalisation & Cultural Change','Cultural Heritage Preservation','Housing & Architecture',
    'Transport Infrastructure','Tourism Development','Employment & Labour Markets','Gender Equality','Children & Development',
    'Ageing Population Challenges','Poverty & Inequality','Immigration & Migration','Scientific Research Funding','Space Exploration',
    'Sports & Competition Ethics','Food Security & Agriculture','Language Preservation','Arts Funding & Access','Animal Welfare',
    'Urbanisation & City Planning','Happiness & Life Quality','Digital Communication','Noise & Air Pollution','Water & Energy Resources',
    'Economic Development','International Trade','Social Media Influence','Consumer Culture','Fashion Industry Ethics',
    'Music & Society','Film & Cultural Impact','Literature & Education','Ethics & Morality','War & Peace',
    'Democracy & Governance','Sustainable Development Goals','Charity & International Aid','Community Service & Volunteering','Family Structure & Roles',
    'Marriage & Relationships','Success & Achievement Factors','Mental Health Awareness','Automation & AI in the Workplace','Climate Change Solutions'
  ].map(tag => ({ tag, mod: 'writing' })),
  // ── READING (50) ──
  ...[
    'Biology & Life Sciences','History & Civilisation','Psychology & Human Behaviour','Economics & Business','Environmental Science',
    'Computer Science & IT','Education Research','Public Health & Epidemiology','Archaeology & Antiquities','Marine Biology & Oceans',
    'Sociology & Society','Linguistics & Language','Architecture & Design','Agriculture & Farming','Geography & Landscapes',
    'Anthropology & Culture','Astronomy & Space Science','Chemistry & Materials','Physics & Energy','Neuroscience & the Brain',
    'Genetics & DNA Research','Ecology & Ecosystems','Urban Planning & Cities','Renewable Energy Technologies','Climate Science & Forecasting',
    'Conservation & Wildlife','Human Migration Patterns','Demographics & Population','Philosophy & Ideas','Ethics & Bioethics',
    'World Literature & Poetry','Art History & Movements','Music & Acoustics','Political Science & Governance','International Law & Treaties',
    'Medical Research & Trials','Engineering & Innovation','Artificial Intelligence & Robotics','Mathematics & Statistics','Nutrition Science & Diet',
    'Botany & Plant Science','Zoology & Animal Behaviour','Oceanography & Seas','Meteorology & Weather Patterns','Geology & Earth Science',
    'Palaeontology & Fossils','Transport & Logistics','Communication & Media Studies','Sport Science & Performance','Water Resources & Management'
  ].map(tag => ({ tag, mod: 'reading' })),
  // ── LISTENING (50) ──
  ...[
    'Campus & University Life','Library & Study Facilities','Student Accommodation','Banking & Finance Advice','Travel Booking & Reservations',
    'Job Interviews & Applications','Orientation & Induction','Museums & Gallery Visits','Sports & Recreation Centres','Restaurant & Dining Experiences',
    'Shopping & Consumer Returns','Insurance & Claims','Driving & Vehicle Registration','Course Registration & Enrolment','Moving & Relocation',
    'Biology Lectures','History Lectures','Psychology Lectures','Geography & Environment Lectures','Sociology & Society Lectures',
    'Seminar & Discussion Groups','Tutorial Conversations','Student Support Services','Career Guidance & Counselling','Research Methods & Projects',
    'Laboratory Safety & Procedures','Environmental Field Studies','Field Trips & Excursions','Academic Conferences','Workshop & Training Sessions',
    'Presentation Skills','Study Skills & Techniques','Time Management Strategies','Note-Taking Strategies','Essay & Report Writing',
    'Exam Preparation & Revision','Group Projects & Teamwork','Volunteer & Charity Programmes','Cultural Events & Festivals','Community Services & Support',
    'Fitness & Gym Programmes','Nutrition & Diet Advice','Language Exchange & Practice','Technology & IT Support','Photography & Media Production',
    'Art Classes & Workshops','Music Lessons & Performance','Dance & Movement Classes','Cooking Classes & Food Safety','Healthcare & Clinic Visits'
  ].map(tag => ({ tag, mod: 'listening' })),
];

/* ═══════════════════════════════════════════════════════════════════
   MODULE-SPECIFIC TEMPLATES
   ═══════════════════════════════════════════════════════════════════ */
function getIntro(tag, mod) {
  const M = mod.charAt(0).toUpperCase() + mod.slice(1);
  const t = tag.toLowerCase();
  const intros = {
    speaking: `${tag} is a frequently tested topic in IELTS Speaking. Questions about ${t} can appear in any of the three parts, from simple Part 1 questions to abstract Part 3 discussions. Having a wide range of vocabulary on this subject will help you speak fluently, demonstrate lexical resource, and avoid awkward hesitation when the examiner introduces this theme.`,
    writing: `${tag} is a common theme in IELTS Writing Task 2, where candidates must present well-structured arguments using formal academic vocabulary. A strong command of ${t} vocabulary allows you to express complex ideas precisely, use appropriate collocations, and achieve a higher score for lexical resource across both Task 1 and Task 2.`,
    reading: `Academic passages about ${t} appear regularly in the IELTS Reading module. Understanding the specialised vocabulary used in these texts helps you locate answers faster and comprehend complex arguments. The words below range from common terms you should recognise immediately to expert-level vocabulary found in the most challenging passages.`,
    listening: `${tag} vocabulary frequently appears in IELTS Listening, from everyday conversations in Sections 1 and 2 to academic discussions in Sections 3 and 4. Recognising these words when spoken at natural speed helps you follow the audio, complete answers correctly, and avoid the common spelling mistakes that cost marks in this module.`,
  };
  return intros[mod];
}

function getTips(tag, mod) {
  const t = tag.toLowerCase();
  const tips = {
    speaking: [
      `Practise using ${t} vocabulary in complete sentences, not isolated words.`,
      `Record yourself discussing ${t} topics and review for natural delivery.`,
      `Prepare a short anecdote or example about ${t} for Part 2 long turns.`,
      `Learn collocations — examiners reward natural word combinations over memorised lists.`,
    ],
    writing: [
      `Use ${t} vocabulary precisely — avoid informal language in academic essays.`,
      `Practise paraphrasing — restate questions using different ${t} terms.`,
      `Organise vocabulary into for/against categories when brainstorming arguments.`,
      `Read model band-9 essays on ${t} to see how vocabulary is used in context.`,
    ],
    reading: [
      `When you meet unknown ${t} terms, use context clues to infer meaning.`,
      `Build a vocabulary notebook organised by passage topic.`,
      `Focus on word families — knowing the noun, verb, and adjective forms helps comprehension.`,
      `Practise scanning passages quickly for keywords related to ${t}.`,
    ],
    listening: [
      `Listen to podcasts and lectures about ${t} to build aural recognition.`,
      `Practise spelling ${t} vocabulary correctly — spelling errors cost marks.`,
      `Learn how these words sound in connected speech, not just in isolation.`,
      `Use dictation exercises with ${t}-related audio to sharpen your accuracy.`,
    ],
  };
  return tips[mod];
}

function getMistakes(tag, mod) {
  const t = tag.toLowerCase();
  return {
    speaking: [
      `Using overly simple vocabulary when more precise ${t} terms are available.`,
      `Repeating the same word instead of demonstrating a range of synonyms.`,
      `Mispronouncing key ${t} terms, which reduces clarity.`,
      `Using memorised phrases that sound rehearsed and unnatural.`,
    ],
    writing: [
      `Using informal or spoken language when formal ${t} terms are expected.`,
      `Making spelling errors in key ${t} vocabulary.`,
      `Using words without fully understanding their meaning, leading to misuse.`,
      `Overusing a narrow range of ${t} vocabulary instead of demonstrating range.`,
    ],
    reading: [
      `Assuming a word always carries the same meaning across all contexts.`,
      `Panicking when encountering unfamiliar ${t} terms instead of reading on.`,
      `Confusing similar-looking ${t} words in dense academic passages.`,
      `Spending too long on one unknown word instead of reading for overall meaning.`,
    ],
    listening: [
      `Mishearing similar-sounding ${t} words at natural speaking speed.`,
      `Writing incorrect spellings of ${t} terms on the answer sheet.`,
      `Failing to recognise paraphrased versions of ${t} vocabulary from the question.`,
      `Losing concentration when unfamiliar ${t} words are used in the recording.`,
    ],
  }[mod];
}

function getFaq(tag, mod) {
  const t = tag.toLowerCase();
  return {
    speaking: [`How many ${t} vocabulary words do I need for IELTS Speaking band 7?`, `You should aim to use at least 15–20 relevant words and phrases naturally. The examiner values accuracy and appropriacy over quantity. Focus on words you can use confidently in real conversation rather than memorising long lists you cannot control under pressure.`],
    writing: [`Should I use very advanced ${t} vocabulary in my IELTS essay?`, `Only use advanced vocabulary you can control accurately. A few well-chosen words are far more effective than many used incorrectly. The examiner rewards precision and appropriacy — not complexity for its own sake.`],
    reading: [`What if I encounter unknown ${t} vocabulary in an IELTS Reading passage?`, `Stay calm and use context clues, word roots, and surrounding sentences to infer meaning. You do not need to understand every word to answer the questions correctly — focus on the main argument and key information.`],
    listening: [`How can I better recognise ${t} vocabulary in IELTS Listening recordings?`, `Regular exposure is essential. Listen to English podcasts, TED Talks, and lectures about ${t}. Practise dictation exercises and focus on how words are pronounced in connected speech and at natural speed.`],
  }[mod];
}

/* ═══════════════════════════════════════════════════════════════════
   BUILD ARTICLE BODY (Markdown ≥ 500 words)
   ═══════════════════════════════════════════════════════════════════ */
function buildBody(t) {
  const M = t.mod.charAt(0).toUpperCase() + t.mod.slice(1);
  const tbl = (rows, label) => {
    let s = `### ${label}\n\n| Word / Phrase | Part of Speech | Definition | Example Sentence |\n|---|---|---|---|\n`;
    rows.forEach(([w, p, d, e]) => { s += `| ${w} | ${p} | ${d} | ${e} |\n`; });
    return s + '\n';
  };
  let b = `# ${t.title}\n\n${t.intro}\n\n`;
  b += `## Essential Vocabulary by Band Level\n\nThe tables below group the most useful vocabulary for this topic by target band score. Start with the band closest to your current level and work upward.\n\n`;
  b += tbl(t.b56, 'Band 5\u20136: Foundation Level');
  b += tbl(t.b67, 'Band 6\u20137: Intermediate Level');
  b += tbl(t.b78, 'Band 7\u20138: Advanced Level');
  b += tbl(t.b89, 'Band 8\u20139: Expert Level');
  b += `## Key Collocations\n\n| Collocation | Example Sentence |\n|---|---|\n`;
  t.colls.forEach(([c, e]) => { b += `| ${c} | ${e} |\n`; });
  b += '\n## Common Mistakes to Avoid\n\n';
  t.mistakes.forEach(m => { b += `- ${m}\n`; });
  b += `\n## Practice Tips for IELTS ${M}\n\n`;
  t.tips.forEach((tip, i) => { b += `${i + 1}. ${tip}\n`; });
  b += `\n## Frequently Asked Question\n\n**${t.faq[0]}**\n\n${t.faq[1]}\n\n`;
  b += `## Key Takeaway\n\nBuilding strong vocabulary for ${t.tag.toLowerCase()} is one of the fastest ways to improve your IELTS ${M} band score. Focus on learning words in context rather than memorising isolated definitions. Start with the band level closest to your target, practise using each word in full sentences, and gradually move to higher-band vocabulary as your confidence grows. Consistent daily review using spaced repetition will help these words become part of your active vocabulary.\n`;
  return b;
}

/* ═══════════════════════════════════════════════════════════════════
   ASSEMBLE AND SEED
   ═══════════════════════════════════════════════════════════════════ */
async function main() {
  if (!DB_URL) { console.error('Set SUPABASE_DB_URL'); process.exit(1); }

  // 1. Build all 200 topic objects
  const topics = TOPIC_DEFS.map((def) => {
    const pool = matchPool(def.tag);
    const M = def.mod.charAt(0).toUpperCase() + def.mod.slice(1);
    return {
      title: `IELTS ${M} Vocabulary: ${def.tag}`,
      mod: def.mod,
      tag: def.tag,
      intro: getIntro(def.tag, def.mod),
      b56: pool.b56,
      b67: pool.b67,
      b78: pool.b78,
      b89: pool.b89,
      colls: pool.colls,
      mistakes: getMistakes(def.tag, def.mod),
      tips: getTips(def.tag, def.mod),
      faq: getFaq(def.tag, def.mod),
    };
  });

  // Verify pool distribution
  const poolCounts = {};
  topics.forEach(t => {
    const pName = Object.keys(POOLS).find(k => POOLS[k].b56 === t.b56) || 'unknown';
    poolCounts[pName] = (poolCounts[pName] || 0) + 1;
  });
  console.log('Pool distribution:');
  Object.entries(poolCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nTotal topics: ${topics.length}`);
  console.log(`  Speaking: ${topics.filter(t=>t.mod==='speaking').length}`);
  console.log(`  Writing: ${topics.filter(t=>t.mod==='writing').length}`);
  console.log(`  Reading: ${topics.filter(t=>t.mod==='reading').length}`);
  console.log(`  Listening: ${topics.filter(t=>t.mod==='listening').length}`);

  // 2. Connect to Supabase
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

  // 3. Seed articles (table: blog_posts with id TEXT + data JSONB)
  let inserted = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const t of topics) {
    const slug = slugify(t.title);
    const body = buildBody(t);
    const id = genId();
    const data = {
      _id: id,
      slug,
      title: t.title,
      body,
      excerpt: `Master IELTS ${t.mod} vocabulary for ${t.tag}. Band 5\u20139 word lists with definitions, example sentences, collocations, and expert tips.`,
      tags: ['ielts', t.mod, 'vocabulary', t.tag.toLowerCase().split(' ')[0]],
      cluster: `ielts-${t.mod}-vocabulary`,
      state: 'published',
      module: t.mod,
      category: 'vocabulary',
      topic: t.tag,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    };
    try {
      // Check if slug already exists
      const existing = await pool.query(
        `SELECT id FROM blog_posts WHERE data->>'slug' = $1 LIMIT 1`, [slug]
      );
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      await pool.query(
        `INSERT INTO blog_posts (id, data, created_at, updated_at) VALUES ($1, $2, now(), now())`,
        [id, JSON.stringify(data)]
      );
      inserted++;
    } catch (err) {
      console.error(`  SKIP ${slug}: ${err.message}`);
      skipped++;
    }
    if (inserted % 25 === 0 && inserted > 0) console.log(`  Inserted ${inserted}...`);
  }

  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);

  // 4. Quick stats
  const { rows } = await pool.query(
    `SELECT data->>'cluster' AS cluster, count(*) AS c FROM blog_posts WHERE data->>'category' = 'vocabulary' GROUP BY 1 ORDER BY 1`
  );
  console.log('\nVocabulary articles in DB:');
  rows.forEach(r => console.log(`  ${r.cluster}: ${r.c}`));

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
