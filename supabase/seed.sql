insert into public.ingredients (id, name, category) values
  ('espresso', 'Espresso', 'Essentials'),
  ('ice', 'Ice', 'Essentials'),
  ('water', 'Filtered water', 'Essentials'),
  ('milk', 'Milk', 'Milk'),
  ('oat-milk', 'Oat milk', 'Milk'),
  ('cream', 'Heavy cream', 'Milk'),
  ('vanilla', 'Vanilla syrup', 'Syrups'),
  ('pistachio', 'Pistachio syrup', 'Syrups'),
  ('maple', 'Maple syrup', 'Syrups'),
  ('caramel-sauce', 'Caramel sauce', 'Sauces'),
  ('chocolate-sauce', 'Chocolate sauce', 'Sauces'),
  ('brown-sugar', 'Brown sugar', 'Pantry'),
  ('cinnamon', 'Cinnamon', 'Pantry'),
  ('honey', 'Honey', 'Pantry'),
  ('salt', 'Sea salt', 'Pantry'),
  ('whipped-cream', 'Whipped cream', 'Toppings'),
  ('cocoa', 'Cocoa powder', 'Toppings')
on conflict (id) do update set name = excluded.name, category = excluded.category;

insert into public.equipment (id, name) values
  ('espresso-machine', 'Espresso machine'),
  ('grinder', 'Grinder'),
  ('milk-frother', 'Milk frother'),
  ('nespresso', 'Nespresso'),
  ('keurig', 'Keurig'),
  ('moka-pot', 'Moka pot'),
  ('french-press', 'French press'),
  ('pour-over', 'Pour-over'),
  ('blender', 'Blender'),
  ('shaker', 'Shaker')
on conflict (id) do update set name = excluded.name;

insert into public.recipes (
  id, slug, name, subtitle, inspiration, description, image_url, minutes,
  difficulty, temperature, servings, cup_size, tags, ingredient_search_text, published
) values
  (
    '1', 'pistachio-latte', 'Iced Pistachio Latte', 'Creamy, nutty, café-style',
    'Specialty café inspired',
    'A smooth espresso drink with pistachio sweetness, cold milk, and plenty of ice.',
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=1200&q=85',
    10, 'Easy', 'Iced', 1, '16 oz', array['Iced', 'Sweet', 'Quick'],
    'Espresso Pistachio syrup Milk of choice Ice Sea salt Cold foam', true
  ),
  (
    '2', 'brown-sugar-shaken-espresso', 'Brown Sugar Shaken Espresso', 'Bold, spiced, and silky',
    'Starbucks Inspired',
    'Bold espresso shaken with brown sugar, cinnamon, and ice, finished with oat milk.',
    'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=1200&q=85',
    5, 'Easy', 'Iced', 1, '16 oz', array['Iced', 'Strong', 'Popular', 'Quick'],
    'Espresso Brown sugar Cinnamon Oat milk Ice Vanilla Sea salt', true
  ),
  (
    '3', 'salted-maple-cold-foam', 'Salted Maple Cold Foam', 'Sweet, airy, and cozy',
    'Autumn café inspired',
    'A chilled espresso topped with maple cream cold foam and a touch of flaky salt.',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=85',
    10, 'Easy', 'Iced', 1, '16 oz', array['Iced', 'Sweet', 'Seasonal'],
    'Espresso Maple syrup Milk Heavy cream Ice Flaky salt', true
  ),
  (
    '4', 'honey-cinnamon-oat-latte', 'Honey Cinnamon Oat Latte', 'Soft sweetness, warm spice',
    'Neighborhood café inspired',
    'A cozy latte with honey, cinnamon, espresso, and oat milk.',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85',
    7, 'Easy', 'Hot', 1, '12 oz', array['Hot', 'Cozy', 'Quick'],
    'Espresso Honey Cinnamon Oat milk Sea salt', true
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  subtitle = excluded.subtitle,
  inspiration = excluded.inspiration,
  description = excluded.description,
  image_url = excluded.image_url,
  minutes = excluded.minutes,
  difficulty = excluded.difficulty,
  temperature = excluded.temperature,
  servings = excluded.servings,
  cup_size = excluded.cup_size,
  tags = excluded.tags,
  ingredient_search_text = excluded.ingredient_search_text,
  published = excluded.published;

delete from public.recipe_ingredients where recipe_id in ('1', '2', '3', '4');
delete from public.recipe_equipment where recipe_id in ('1', '2', '3', '4');
delete from public.recipe_steps where recipe_id in ('1', '2', '3', '4');

insert into public.recipe_ingredients
  (recipe_id, ingredient_id, position, quantity, unit, display_name, note, optional)
values
  ('1', 'espresso', 1, 2, 'shot', 'Espresso', null, false),
  ('1', 'pistachio', 2, 1.5, 'tbsp', 'Pistachio syrup', null, false),
  ('1', 'milk', 3, 0.75, 'cup', 'Milk of choice', null, false),
  ('1', 'ice', 4, 1, 'cup', 'Ice', null, false),
  ('1', 'salt', 5, 1, 'pinch', 'Sea salt', null, false),
  ('1', 'cream', 6, 0.25, 'cup', 'Cold foam', 'For topping', true),
  ('2', 'espresso', 1, 2, 'shot', 'Espresso', null, false),
  ('2', 'brown-sugar', 2, 1.5, 'tbsp', 'Brown sugar', null, false),
  ('2', 'cinnamon', 3, 0.25, 'tsp', 'Cinnamon', null, false),
  ('2', 'oat-milk', 4, 0.25, 'cup', 'Oat milk', null, false),
  ('2', 'ice', 5, 1, 'cup', 'Ice', null, false),
  ('2', 'vanilla', 6, 0.25, 'tsp', 'Vanilla', null, false),
  ('2', 'salt', 7, 1, 'pinch', 'Sea salt', 'Tiny pinch', false),
  ('3', 'espresso', 1, 2, 'shot', 'Espresso', null, false),
  ('3', 'maple', 2, 1, 'tbsp', 'Maple syrup', null, false),
  ('3', 'milk', 3, 0.5, 'cup', 'Milk', null, false),
  ('3', 'cream', 4, 2, 'tbsp', 'Heavy cream', null, false),
  ('3', 'ice', 5, 1, 'cup', 'Ice', null, false),
  ('3', 'salt', 6, 1, 'pinch', 'Flaky salt', null, false),
  ('4', 'espresso', 1, 2, 'shot', 'Espresso', null, false),
  ('4', 'honey', 2, 1, 'tbsp', 'Honey', null, false),
  ('4', 'cinnamon', 3, 0.25, 'tsp', 'Cinnamon', null, false),
  ('4', 'oat-milk', 4, 0.75, 'cup', 'Oat milk', null, false),
  ('4', 'salt', 5, 1, 'pinch', 'Sea salt', null, false);

insert into public.recipe_equipment (recipe_id, equipment_id, position) values
  ('1', 'espresso-machine', 1),
  ('1', 'milk-frother', 2),
  ('2', 'espresso-machine', 1),
  ('2', 'shaker', 2),
  ('3', 'espresso-machine', 1),
  ('3', 'milk-frother', 2),
  ('4', 'espresso-machine', 1),
  ('4', 'milk-frother', 2);

insert into public.recipe_steps (recipe_id, position, instruction, timer_seconds) values
  ('1', 1, 'Pull two shots of espresso.', null),
  ('1', 2, 'Stir the pistachio syrup and sea salt into the hot espresso.', null),
  ('1', 3, 'Fill a tall glass with ice and milk.', null),
  ('1', 4, 'Froth the cold foam until airy, then pour the espresso over the milk and finish with foam.', 30),
  ('2', 1, 'Pull two espresso shots.', null),
  ('2', 2, 'Add the espresso, brown sugar, cinnamon, vanilla, and ice to a shaker.', null),
  ('2', 3, 'Shake vigorously until chilled and foamy.', 15),
  ('2', 4, 'Pour into a tall glass and finish with oat milk.', null),
  ('3', 1, 'Whisk the cream, milk, maple syrup, and salt until thick and foamy.', 30),
  ('3', 2, 'Fill a glass with ice and pour in the espresso.', null),
  ('3', 3, 'Spoon the maple cold foam over the espresso and finish with flaky salt.', null),
  ('4', 1, 'Stir the honey, cinnamon, and salt into the espresso.', null),
  ('4', 2, 'Steam the oat milk until silky and lightly foamed.', 45),
  ('4', 3, 'Pour the milk into the espresso and finish with a dusting of cinnamon.', null);
