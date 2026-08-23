-- Weekend 6: recipe draft template library (separate from discovered-drink seeding — see
-- docs/CONTENT_LIBRARY.md "Seed strategy"). Idempotent: every row seeded here carries a stable
-- `seed_key`, and inserts use `on conflict (seed_key) do nothing`, so re-running this file never
-- duplicates rows and never overwrites a draft an admin has since edited by hand. Collection
-- membership is (re)applied by seed_key lookup so it stays correct even if this file gains rows
-- later; `on conflict do nothing` on the join table means a manually-removed collection tag is
-- also left alone on re-run.
--
-- Content rule: every "inspired" entry is a Crema-original description and instructions, labeled
-- with its inspiration (e.g. "Starbucks Inspired") plus a source name/URL for attribution. No
-- third-party preparation instructions, marketing copy, or images are copied. All rows are
-- seeded as status='draft', needs_testing=true; nothing here is auto-published or auto-tested.

-- 1) Backfill seed_key on the 14 drafts already seeded in 20260822010000_recipe_authoring.sql,
--    so they participate in idempotent collection tagging below.
update public.recipe_drafts set seed_key = v.seed_key
from (values
  ('Caramel Macchiato','Starbucks','starbucks-caramel-macchiato'),
  ('Vanilla Sweet Cream Cold Brew','Starbucks','starbucks-vanilla-sweet-cream-cold-brew'),
  ('Iced White Mocha','Starbucks','starbucks-iced-white-mocha'),
  ('Pistachio Latte','Starbucks','starbucks-pistachio-latte'),
  ('Golden Eagle','Dutch Bros','dutch-bros-golden-eagle'),
  ('Caramelizer','Dutch Bros','dutch-bros-caramelizer'),
  ('Annihilator','Dutch Bros','dutch-bros-annihilator'),
  ('Butter Pecan Latte','Dunkin''','dunkin-butter-pecan-latte'),
  ('Caramelicious','Scooter''s Coffee','scooters-caramelicious'),
  ('Spanish Latte','','around-world-spanish-latte'),
  ('Vietnamese Iced Coffee','','around-world-vietnamese-iced-coffee'),
  ('Café Bombón','','around-world-cafe-bombon'),
  ('Affogato','','espresso-classic-affogato'),
  ('Espresso Tonic','','crema-original-espresso-tonic')
) as v(proposed_title, source_name, seed_key)
where public.recipe_drafts.seed_key is null
  and public.recipe_drafts.proposed_title = v.proposed_title
  and public.recipe_drafts.source_name = v.source_name;

-- 2) New draft templates.
insert into public.recipe_drafts (
  proposed_title, inspiration_label, source_name, source_url, description,
  category, temperature, flavor_notes, status, needs_testing, seed_key
)
values
  -- Starbucks Inspired (remaining)
  ('Honey Almond Flat White','Starbucks Inspired','Starbucks','https://www.starbucks.com/menu',
    'Our take on a flat white finished with honey and toasted almond notes.','espresso','either',
    array['honey','nutty'],'draft',true,'starbucks-honey-almond-flat-white'),
  ('Blonde Vanilla Latte','Starbucks Inspired','Starbucks','https://www.starbucks.com/menu',
    'A lighter-roast latte concept rounded out with vanilla.','espresso','either',
    array['vanilla','lightly-sweet'],'draft',true,'starbucks-blonde-vanilla-latte'),
  ('Pumpkin Spice Latte','Starbucks Inspired','Starbucks','https://www.starbucks.com/menu',
    'A seasonal latte concept built on pumpkin and warm spice.','seasonal','either',
    array['pumpkin','cinnamon','seasonal'],'draft',true,'starbucks-pumpkin-spice-latte'),
  ('Peppermint Mocha','Starbucks Inspired','Starbucks','https://www.starbucks.com/menu',
    'A cold-weather mocha concept with peppermint and chocolate.','seasonal','either',
    array['peppermint','chocolate','seasonal'],'draft',true,'starbucks-peppermint-mocha'),
  ('Cinnamon Dolce Latte','Starbucks Inspired','Starbucks','https://www.starbucks.com/menu',
    'A latte concept with cinnamon-sugar sweetness.','espresso','either',
    array['cinnamon','lightly-sweet'],'draft',true,'starbucks-cinnamon-dolce-latte'),
  ('Brown Sugar Shaken Espresso (Draft Template)','Starbucks Inspired','Starbucks','https://www.starbucks.com/menu',
    'Espresso shaken over ice with brown sugar and cinnamon, finished with milk.','espresso','iced',
    array['brown-sugar','strong','quick'],'draft',true,'starbucks-brown-sugar-shaken-espresso-template'),

  -- Dutch Bros Inspired (remaining)
  ('Cocomo','Dutch Bros Inspired','Dutch Bros','https://www.dutchbros.com/menu',
    'A tropical-leaning cold espresso concept with coconut and caramel notes.','espresso','either',
    array['coconut','caramel'],'draft',true,'dutch-bros-cocomo'),
  ('Kicker','Dutch Bros Inspired','Dutch Bros','https://www.dutchbros.com/menu',
    'An extra-bold cold espresso concept with vanilla and caramel.','espresso','either',
    array['vanilla','caramel','strong'],'draft',true,'dutch-bros-kicker'),
  ('Picture Perfect','Dutch Bros Inspired','Dutch Bros','https://www.dutchbros.com/menu',
    'A caramel-and-chocolate espresso concept.','espresso','either',
    array['caramel','chocolate'],'draft',true,'dutch-bros-picture-perfect'),
  ('9-1-1','Dutch Bros Inspired','Dutch Bros','https://www.dutchbros.com/menu',
    'A high-caffeine espresso-and-energy concept.','espresso','either',
    array['strong'],'draft',true,'dutch-bros-9-1-1'),
  ('Soft Top Cold Brew','Dutch Bros Inspired','Dutch Bros','https://www.dutchbros.com/menu',
    'Cold brew topped with a soft sweet cream cold foam.','cold brew','iced',
    array['creamy','lightly-sweet'],'draft',true,'dutch-bros-soft-top-cold-brew'),

  -- Dunkin' Inspired (remaining)
  ('Caramel Swirl Latte','Dunkin'' Inspired','Dunkin''','https://www.dunkindonuts.com/en/menu',
    'A latte concept with caramel swirled throughout.','espresso','either',
    array['caramel'],'draft',true,'dunkin-caramel-swirl-latte'),
  ('Mocha Swirl Iced Coffee','Dunkin'' Inspired','Dunkin''','https://www.dunkindonuts.com/en/menu',
    'Iced coffee concept with a mocha swirl.','coffee','iced',
    array['chocolate'],'draft',true,'dunkin-mocha-swirl-iced-coffee'),
  ('Cold Brew with Sweet Cold Foam','Dunkin'' Inspired','Dunkin''','https://www.dunkindonuts.com/en/menu',
    'Cold brew topped with a lightly sweetened cold foam.','cold brew','iced',
    array['creamy','lightly-sweet','quick'],'draft',true,'dunkin-cold-brew-sweet-cold-foam'),
  ('Vanilla Bean Frozen Coffee','Dunkin'' Inspired','Dunkin''','https://www.dunkindonuts.com/en/menu',
    'A blended frozen coffee concept with vanilla bean.','blended','iced',
    array['vanilla','creamy'],'draft',true,'dunkin-vanilla-bean-frozen-coffee'),

  -- Scooter's Inspired (remaining)
  ('White Mocha','Scooter''s Inspired','Scooter''s Coffee','https://www.scooterscoffee.com/menu',
    'A white-chocolate mocha concept.','espresso','either',
    array['white-chocolate'],'draft',true,'scooters-white-mocha'),
  ('Cinnamon Brown Sugar Latte','Scooter''s Inspired','Scooter''s Coffee','https://www.scooterscoffee.com/menu',
    'A latte concept with cinnamon and brown sugar.','espresso','either',
    array['cinnamon','brown-sugar'],'draft',true,'scooters-cinnamon-brown-sugar-latte'),
  ('Honey Vanilla Latte','Scooter''s Inspired','Scooter''s Coffee','https://www.scooterscoffee.com/menu',
    'A latte concept sweetened with honey and vanilla.','espresso','either',
    array['honey','vanilla'],'draft',true,'scooters-honey-vanilla-latte'),
  ('Salted Caramel Latte','Scooter''s Inspired','Scooter''s Coffee','https://www.scooterscoffee.com/menu',
    'A latte concept with salted caramel.','espresso','either',
    array['caramel'],'draft',true,'scooters-salted-caramel-latte'),

  -- Espresso Classics
  ('Espresso','Espresso Classic','',null,
    'A straight double shot of espresso.','classic','hot',
    array['strong'],'draft',true,'classic-espresso'),
  ('Americano','Espresso Classic','',null,
    'Espresso lengthened with hot water.','classic','hot',
    array['strong'],'draft',true,'classic-americano'),
  ('Latte','Espresso Classic','',null,
    'Espresso with steamed milk and a thin layer of foam.','classic','either',
    array['creamy'],'draft',true,'classic-latte'),
  ('Cappuccino','Espresso Classic','',null,
    'Equal parts espresso, steamed milk, and milk foam.','classic','hot',
    array['creamy'],'draft',true,'classic-cappuccino'),
  ('Flat White','Espresso Classic','',null,
    'Espresso with steamed milk and a thin microfoam layer.','classic','hot',
    array['creamy','strong'],'draft',true,'classic-flat-white'),
  ('Cortado','Espresso Classic','',null,
    'Espresso cut with a small amount of warm milk.','classic','hot',
    array['strong'],'draft',true,'classic-cortado'),
  ('Macchiato','Espresso Classic','',null,
    'Espresso marked with a small dollop of milk foam.','classic','hot',
    array['strong'],'draft',true,'classic-macchiato'),
  ('Mocha','Espresso Classic','',null,
    'Espresso with chocolate and steamed milk.','classic','either',
    array['chocolate','creamy'],'draft',true,'classic-mocha'),

  -- Around the World (remaining)
  ('Greek Frappé','Around the World','',null,
    'A frothy iced instant-coffee tradition from Greece.','around the world','iced',
    array['fruity','strong'],'draft',true,'around-world-greek-frappe'),
  ('Dalgona Coffee','Around the World','',null,
    'Whipped instant coffee spooned over milk, popularized in South Korea.','around the world','either',
    array['creamy','strong'],'draft',true,'around-world-dalgona-coffee'),
  ('Café au Lait','Around the World','',null,
    'Equal parts brewed coffee and steamed milk, a French tradition.','around the world','hot',
    array['creamy'],'draft',true,'around-world-cafe-au-lait'),

  -- Crema Originals
  ('Maple Sea Salt Latte','Crema Original','',null,
    'A Crema original latte with maple syrup and a touch of sea salt.','Crema original','either',
    array['maple','creamy'],'draft',true,'crema-original-maple-sea-salt-latte'),
  ('Vanilla Cardamom Latte','Crema Original','',null,
    'A Crema original latte pairing vanilla with warm cardamom.','Crema original','either',
    array['vanilla','floral'],'draft',true,'crema-original-vanilla-cardamom-latte'),
  ('Brown Sugar Cold Foam Latte','Crema Original','',null,
    'A Crema original iced latte topped with brown sugar cold foam.','Crema original','iced',
    array['brown-sugar','creamy'],'draft',true,'crema-original-brown-sugar-cold-foam-latte'),
  ('Toasted Coconut Mocha','Crema Original','',null,
    'A Crema original mocha with toasted coconut.','Crema original','either',
    array['coconut','chocolate'],'draft',true,'crema-original-toasted-coconut-mocha')
on conflict (seed_key) where seed_key is not null do nothing;

-- 3) Collection tagging by seed_key (idempotent; leaves manually-edited collections alone since
--    it only ever adds rows and never deletes).
insert into public.recipe_draft_collections (draft_id, collection_id)
select d.id, m.collection_id
from public.recipe_drafts d
join (values
  ('starbucks-caramel-macchiato','coffee-shop-inspired'),
  ('starbucks-vanilla-sweet-cream-cold-brew','coffee-shop-inspired'),
  ('starbucks-vanilla-sweet-cream-cold-brew','iced-favorites'),
  ('starbucks-iced-white-mocha','coffee-shop-inspired'),
  ('starbucks-iced-white-mocha','iced-favorites'),
  ('starbucks-pistachio-latte','coffee-shop-inspired'),
  ('dutch-bros-golden-eagle','coffee-shop-inspired'),
  ('dutch-bros-caramelizer','coffee-shop-inspired'),
  ('dutch-bros-annihilator','coffee-shop-inspired'),
  ('dunkin-butter-pecan-latte','coffee-shop-inspired'),
  ('scooters-caramelicious','coffee-shop-inspired'),
  ('around-world-spanish-latte','around-the-world'),
  ('around-world-vietnamese-iced-coffee','around-the-world'),
  ('around-world-vietnamese-iced-coffee','iced-favorites'),
  ('around-world-cafe-bombon','around-the-world'),
  ('espresso-classic-affogato','espresso-classics'),
  ('crema-original-espresso-tonic','crema-originals'),
  ('crema-original-espresso-tonic','iced-favorites'),

  ('starbucks-honey-almond-flat-white','coffee-shop-inspired'),
  ('starbucks-blonde-vanilla-latte','coffee-shop-inspired'),
  ('starbucks-pumpkin-spice-latte','coffee-shop-inspired'),
  ('starbucks-pumpkin-spice-latte','seasonal-favorites'),
  ('starbucks-peppermint-mocha','coffee-shop-inspired'),
  ('starbucks-peppermint-mocha','seasonal-favorites'),
  ('starbucks-cinnamon-dolce-latte','coffee-shop-inspired'),
  ('starbucks-brown-sugar-shaken-espresso-template','coffee-shop-inspired'),
  ('starbucks-brown-sugar-shaken-espresso-template','iced-favorites'),
  ('starbucks-brown-sugar-shaken-espresso-template','five-minute-coffees'),

  ('dutch-bros-cocomo','coffee-shop-inspired'),
  ('dutch-bros-kicker','coffee-shop-inspired'),
  ('dutch-bros-picture-perfect','coffee-shop-inspired'),
  ('dutch-bros-9-1-1','coffee-shop-inspired'),
  ('dutch-bros-soft-top-cold-brew','coffee-shop-inspired'),
  ('dutch-bros-soft-top-cold-brew','iced-favorites'),

  ('dunkin-caramel-swirl-latte','coffee-shop-inspired'),
  ('dunkin-mocha-swirl-iced-coffee','coffee-shop-inspired'),
  ('dunkin-mocha-swirl-iced-coffee','iced-favorites'),
  ('dunkin-cold-brew-sweet-cold-foam','coffee-shop-inspired'),
  ('dunkin-cold-brew-sweet-cold-foam','iced-favorites'),
  ('dunkin-cold-brew-sweet-cold-foam','five-minute-coffees'),
  ('dunkin-vanilla-bean-frozen-coffee','coffee-shop-inspired'),
  ('dunkin-vanilla-bean-frozen-coffee','iced-favorites'),

  ('scooters-white-mocha','coffee-shop-inspired'),
  ('scooters-cinnamon-brown-sugar-latte','coffee-shop-inspired'),
  ('scooters-honey-vanilla-latte','coffee-shop-inspired'),
  ('scooters-salted-caramel-latte','coffee-shop-inspired'),

  ('classic-espresso','espresso-classics'),
  ('classic-espresso','five-minute-coffees'),
  ('classic-espresso','beginner-friendly'),
  ('classic-americano','espresso-classics'),
  ('classic-americano','five-minute-coffees'),
  ('classic-americano','beginner-friendly'),
  ('classic-latte','espresso-classics'),
  ('classic-latte','beginner-friendly'),
  ('classic-cappuccino','espresso-classics'),
  ('classic-cappuccino','beginner-friendly'),
  ('classic-flat-white','espresso-classics'),
  ('classic-cortado','espresso-classics'),
  ('classic-macchiato','espresso-classics'),
  ('classic-mocha','espresso-classics'),

  ('around-world-greek-frappe','around-the-world'),
  ('around-world-greek-frappe','iced-favorites'),
  ('around-world-dalgona-coffee','around-the-world'),
  ('around-world-cafe-au-lait','around-the-world'),
  ('around-world-cafe-au-lait','beginner-friendly'),

  ('crema-original-maple-sea-salt-latte','crema-originals'),
  ('crema-original-vanilla-cardamom-latte','crema-originals'),
  ('crema-original-brown-sugar-cold-foam-latte','crema-originals'),
  ('crema-original-brown-sugar-cold-foam-latte','iced-favorites'),
  ('crema-original-toasted-coconut-mocha','crema-originals')
) as m(seed_key, collection_id) on m.seed_key = d.seed_key
on conflict (draft_id, collection_id) do nothing;

-- 4) Tag the four already-published legacy recipes (seeded in seed.sql, pre-dating collections)
--    into the new taxonomy. This only categorizes existing published content — it does not
--    create, test, or publish anything new.
insert into public.published_recipe_collections (recipe_id, collection_id)
values
  ('1','coffee-shop-inspired'), ('1','iced-favorites'), ('1','five-minute-coffees'), ('1','beginner-friendly'),
  ('2','coffee-shop-inspired'), ('2','iced-favorites'), ('2','five-minute-coffees'), ('2','beginner-friendly'),
  ('3','crema-originals'), ('3','seasonal-favorites'), ('3','iced-favorites'),
  ('4','crema-originals'), ('4','beginner-friendly')
on conflict (recipe_id, collection_id) do nothing;

update public.recipes set collection_search_text = coalesce((
  select string_agg(c.title, ' ')
  from public.published_recipe_collections prc join public.recipe_collections c on c.id = prc.collection_id
  where prc.recipe_id = recipes.id
), '')
where id in ('1','2','3','4');
