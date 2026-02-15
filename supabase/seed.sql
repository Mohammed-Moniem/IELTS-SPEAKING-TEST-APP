-- Minimal dev seed data for Spokio

-- Topics
insert into public.topics (slug, title, description, part, category, difficulty, is_premium)
values
  ('part1-work', 'Work', 'Warm-up questions about work and routines.', 1, 'part1', 'beginner', false),
  ('part1-hometown', 'Hometown', 'Talk about where you live and what you like about it.', 1, 'part1', 'beginner', false),
  ('part1-hobbies', 'Hobbies', 'Discuss hobbies and free-time activities.', 1, 'part1', 'intermediate', false),
  ('part2-favorite-place', 'A Favorite Place', 'Describe a place you like and why it matters to you.', 2, 'part2', 'intermediate', false),
  ('part2-a-challenge', 'A Challenge You Faced', 'Describe a challenge and how you handled it.', 2, 'part2', 'advanced', false),
  ('part2-a-person', 'An Inspiring Person', 'Describe a person who inspires you.', 2, 'part2', 'intermediate', false),
  ('part3-technology', 'Technology', 'Discuss how technology affects society.', 3, 'part3', 'intermediate', false),
  ('part3-education', 'Education', 'Discuss learning, schools, and the future of education.', 3, 'part3', 'advanced', false),
  ('part3-environment', 'Environment', 'Discuss environmental issues and solutions.', 3, 'part3', 'intermediate', false)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  part = excluded.part,
  category = excluded.category,
  difficulty = excluded.difficulty,
  is_premium = excluded.is_premium,
  updated_at = now();

-- IELTS question bank (small starter set)
insert into public.ielts_questions (category, difficulty, question, follow_up_questions, keywords, topic, source, verified, active)
values
  ('part1', 'easy', 'Do you like your work or studies?', array['Why?', 'What do you enjoy most?'], array['work','study','part1'], 'work', 'seed', true, true),
  ('part1', 'easy', 'What do you usually do on weekends?', array['Do you prefer staying in or going out?'], array['weekend','routine','part1'], 'weekends', 'seed', true, true),
  ('part1', 'medium', 'Do you prefer mornings or evenings?', array['Why do you prefer that time of day?'], array['time','morning','evening','part1'], 'time of day', 'seed', true, true),
  ('part2', 'medium', 'Describe a place you enjoy visiting.', array['Where is it?', 'Why do you like it?'], array['place','travel','part2'], 'favorite place', 'seed', true, true),
  ('part2', 'hard', 'Describe a challenge you overcame.', array['What happened?', 'What did you learn?'], array['challenge','experience','part2'], 'challenge', 'seed', true, true),
  ('part3', 'medium', 'How has technology changed the way people communicate?', array['What are the pros and cons?'], array['technology','communication','part3'], 'technology', 'seed', true, true),
  ('part3', 'hard', 'What should governments do to protect the environment?', array['Which policies are effective?'], array['environment','government','part3'], 'environment', 'seed', true, true)
on conflict (category, question) do update set
  difficulty = excluded.difficulty,
  follow_up_questions = excluded.follow_up_questions,
  keywords = excluded.keywords,
  topic = excluded.topic,
  source = excluded.source,
  verified = excluded.verified,
  active = excluded.active,
  updated_at = now();

-- Achievements (minimal)
insert into public.achievements (key, name, description, category, icon, points, requirement, is_premium, is_active, sort_order)
values
  ('first_practice', 'First Practice', 'Complete your first practice session.', 'PRACTICE', 'star', 50, jsonb_build_object('type','practice_count','value',1), false, true, 10),
  ('first_simulation', 'First Mock Test', 'Complete your first mock test.', 'PRACTICE', 'trophy', 100, jsonb_build_object('type','simulation_count','value',1), false, true, 20),
  ('streak_3', '3-Day Streak', 'Practice three days in a row.', 'STREAK', 'flame', 75, jsonb_build_object('type','streak_days','value',3), false, true, 30)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  icon = excluded.icon,
  points = excluded.points,
  requirement = excluded.requirement,
  is_premium = excluded.is_premium,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

