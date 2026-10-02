-- A fourth coming-soon activity for the landing page's "What's next" cards.
insert into public.activities (slug, name, status, sort_order) values
  ('food_walks', 'Food walks', 'coming_soon', 70)
on conflict (slug) do nothing;
