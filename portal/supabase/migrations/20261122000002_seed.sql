-- Starting content: the join code (change it in Admin → Settings) and the six
-- Batch 91 classes already listed on learning-today.com.
insert into public.settings (id, join_code) values (1, 'batch91-change-me');

insert into public.classes (number, class_date, title, summary_md, status) values
  (1, '2026-10-18', 'Intro to AI, LLMs and agents', 'Intro to AI, LLMs and agents. Students build their first websites on Lovable.', 'published'),
  (2, '2026-10-25', 'First look at the book', 'First look at the book, The AI Agent Factory, second edition.', 'published'),
  (3, '2026-11-01', 'Chapter 1: from chatbots to AI workers', 'Chapter 1: from chatbots to AI workers.', 'published'),
  (4, '2026-11-08', 'Chapter 1, continued', 'Chapter 1, continued.', 'published'),
  (5, '2026-11-15', 'Chapter 1 and coding agents', 'Chapter 1: The New Way of Working, and coding agents: Claude Code and OpenCode setup.', 'published'),
  (6, '2026-11-22', 'Chapter 2: Tour of the Apps', 'Chapter 2: Tour of the Apps, and the commands you can use in Claude.', 'published');

insert into public.class_materials (class_id, label, url, position)
select c.id, m.label, m.url, m.position
from (values
  (1, 'Slides: Agentic AI Engineering, introductory session', 'https://docs.google.com/presentation/d/118LHEYY9VezecFmWQIVnVjbVDvseOJMxsZUe9W5oWwg/edit?usp=sharing', 0),
  (2, 'The AI Agent Factory, second edition', 'https://agentfactory2.panaversity.org/', 0),
  (3, 'Class Quest: AI Worker Quest, the Chapter 1 game', 'https://claude.ai/artifact/HjZE9nV8mndGoQ27uruEea?sk=e3GCNOAtwTOfj25IwDJLtQ', 0),
  (4, 'Class Quest: AI Worker Quest, the Chapter 1 game', 'https://claude.ai/artifact/HjZE9nV8mndGoQ27uruEea?sk=e3GCNOAtwTOfj25IwDJLtQ', 0),
  (5, 'Claude 2.0 Practical, Chapter 1: The New Way of Working', 'https://claude.ai/artifact/77bKtX6VwqtNxNvx39wAVy?sk=DzBLtP6Nli-szRNlP3bJbg', 0),
  (5, 'Class slides: Claude Code and OpenCode setup', 'https://claude.ai/artifact/VoK6WtACCqGsijNXs4SS1K?sk=tYgJe9077QHkcGowqUkmTA', 1),
  (6, 'Claude 2.0 Practical, Chapter 2: Tour of the Apps', 'https://claude.ai/artifact/77bKtX6VwqtNxNvx39wAVy?sk=DzBLtP6Nli-szRNlP3bJbg', 0)
) as m(class_number, label, url, position)
join public.classes c on c.number = m.class_number;
