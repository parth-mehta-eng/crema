-- Weekend 6: discovery-pipeline output seed (separate from draft templates on purpose — see
-- docs/CONTENT_LIBRARY.md "Seed strategy"). Idempotent via the seed_key unique partial index
-- added in 20260823000000_content_quality_and_collections.sql; safe to re-run.
--
-- These rows simulate what the discovery pipeline would have produced for a handful of
-- well-known drinks, so the admin "Discovered" review queue has real content to triage even
-- before scraping is enabled for any source. No source prose is copied — external_description
-- is a short, original, factual note written by Crema, matching the pipeline's own
-- normalization rules (see docs/COFFEE_DISCOVERY_PIPELINE.md).

insert into public.discovered_drinks (
  source_id, external_name, normalized_name, external_description, source_url,
  category, temperature, flavor_notes, mentioned_ingredients, season, fingerprint, status, seed_key
)
select s.id, v.external_name, v.normalized_name, v.external_description, s.menu_url,
  v.category, v.temperature, v.flavor_notes, v.mentioned_ingredients, v.season,
  encode(digest(s.id::text || ':' || v.seed_key, 'sha256'), 'hex'), 'new', v.seed_key
from (values
  ('starbucks', 'starbucks-honey-almond-flat-white', 'Honey Almond Flat White', 'honey almond flat white',
    'A flat white style drink noted for honey and almond flavoring.', 'latte', 'either',
    array['honey','nutty']::text[], array['espresso','milk','honey']::text[], null::text),
  ('starbucks', 'starbucks-blonde-vanilla-latte', 'Blonde Vanilla Latte', 'blonde vanilla latte',
    'A latte made with blonde espresso and vanilla flavoring.', 'latte', 'either',
    array['vanilla','lightly-sweet']::text[], array['espresso','milk','vanilla']::text[], null),
  ('starbucks', 'starbucks-cinnamon-dolce-latte', 'Cinnamon Dolce Latte', 'cinnamon dolce latte',
    'A latte flavored with cinnamon and brown-sugar-forward syrup.', 'latte', 'either',
    array['cinnamon','sweet']::text[], array['espresso','milk','cinnamon']::text[], null),
  ('dutch-bros', 'dutch-bros-picture-perfect', 'Picture Perfect', 'picture perfect',
    'A cold espresso drink noted for caramel and chocolate flavoring.', 'other', 'iced',
    array['caramel','chocolate']::text[], array['espresso','milk','caramel']::text[], null),
  ('dunkin', 'dunkin-caramel-swirl-latte', 'Caramel Swirl Latte', 'caramel swirl latte',
    'A latte with caramel swirl flavoring, served hot or iced.', 'latte', 'either',
    array['caramel']::text[], array['espresso','milk','caramel']::text[], null),
  ('scooters-coffee', 'scooters-honey-vanilla-latte', 'Honey Vanilla Latte', 'honey vanilla latte',
    'A latte flavored with honey and vanilla.', 'latte', 'either',
    array['honey','vanilla']::text[], array['espresso','milk','honey','vanilla']::text[], null)
) as v(source_slug, seed_key, external_name, normalized_name, external_description, category, temperature, flavor_notes, mentioned_ingredients, season)
join public.coffee_sources s on s.slug = v.source_slug
on conflict (seed_key) where seed_key is not null do nothing;
