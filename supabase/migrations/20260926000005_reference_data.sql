-- Reference data the app needs in every environment (local and hosted).
-- seed.sql only runs locally, so anything production depends on lives here.

insert into public.app_config (key, value) values
  ('UNVERIFIED_DAILY_VIEW_LIMIT', '30'::jsonb)
on conflict (key) do nothing;

-- Coming-soon list is a placeholder pending PLAN.md §9 decision 2.
insert into public.activities (slug, name, status, sort_order) values
  ('garba',        'Garba & Dandiya',   'live',        0),
  ('trekking',     'Trekking',          'coming_soon', 10),
  ('badminton',    'Badminton',         'coming_soon', 20),
  ('concerts',     'Concerts',          'coming_soon', 30),
  ('running',      'Running clubs',     'coming_soon', 40),
  ('board_games',  'Board game nights', 'coming_soon', 50),
  ('cafe_hopping', 'Cafe hopping',      'coming_soon', 60)
on conflict (slug) do nothing;
