-- ==============================================================================
-- Migration: 010_ownera_seed_data.sql
-- Description: Standardized Services and Demo Society Initial Seed Data
-- ==============================================================================

-- 1. Standardized Initial Home Services Catalog
INSERT INTO public.services (id, name, slug, category, description, inclusions, exclusions, typical_duration_minutes, suggested_campaign_days, suggested_slot_duration_minutes, base_price_estimate, icon)
VALUES
  (
    '11111111-1111-1111-1111-111111111001',
    'AC Servicing',
    'ac-servicing',
    'Cooling & HVAC',
    'Standardized jet-pump filter, coil cleaning, drain flush, and gas pressure check for split/window ACs.',
    '["Jet-pump indoor filter wash", "Outdoor unit deep water cleaning", "Drain tray and pipe flush", "Refrigerant gas pressure check", "Operating current and airflow check"]'::jsonb,
    '["Gas top-up or refilling (billed separately if below spec)", "Capacitor or PCB circuit board replacement", "Copper pipe welding or rerouting"]'::jsonb,
    45,
    7,
    60,
    699.00,
    'Wind'
  ),
  (
    '11111111-1111-1111-1111-111111111002',
    'Pest Control',
    'pest-control',
    'Pest & Hygiene',
    'Odorless gel & spray treatment for cockroaches, ants, and common household pests across all rooms.',
    '["Kitchen cabinet gel baiting", "Bathroom drain anti-pest spraying", "Wall perimeter crack & crevice sealing spray", "30-day retreat warranty"]'::jsonb,
    '["Termite drilling / wood treatment", "Bedbug chemical fogging", "Rodent trapping mesh installation"]'::jsonb,
    60,
    7,
    90,
    999.00,
    'Bug'
  ),
  (
    '11111111-1111-1111-1111-111111111003',
    'Deep Cleaning',
    'deep-cleaning',
    'Deep Cleaning',
    'Intensive full-home mechanized scrubbing, degreasing, bathroom descaling, and balcony wash.',
    '["Kitchen tile and countertop degreasing", "Bathroom descaling and sanitation", "Window track and glass wipe down", "Floor mechanized single-disc scrubbing", "Cobweb and ceiling fan dusting"]'::jsonb,
    '["Appliance interior deep chemical clean (chimney/fridge)", "Exterior building window cleaning", "Paint stain removal requiring chemical stripping"]'::jsonb,
    240,
    10,
    240,
    2999.00,
    'Sparkles'
  ),
  (
    '11111111-1111-1111-1111-111111111004',
    'Sofa Cleaning',
    'sofa-cleaning',
    'Fabric & Upholstery',
    'Deep fabric extraction shampooing, stain removal, and sanitization for 3+2 or L-shaped sofas.',
    '["Dry vacuum dust and allergen extraction", "Foam shampoo scrubbing", "Moisture extraction with industrial wet vacuum", "Sanitization spray"]'::jsonb,
    '["Leather re-dying or scratch repair", "Torn cushion stitching", "Permanent ink/acid burn stain removal"]'::jsonb,
    60,
    5,
    60,
    799.00,
    'Armchair'
  ),
  (
    '11111111-1111-1111-1111-111111111005',
    'RO Servicing',
    'ro-servicing',
    'Water & Kitchen',
    'Comprehensive water purifier health check, sediment filter clean, membrane test, and TDS calibration.',
    '["Pre-filter candle wash / inspection", "Membrane efficiency and TDS ppm testing", "Booster pump pressure check", "Internal pipeline sanitization"]'::jsonb,
    '["RO membrane replacement (billed as per original brand spare)", "Booster pump or SMPS adapter replacement"]'::jsonb,
    45,
    5,
    60,
    499.00,
    'Droplet'
  ),
  (
    '11111111-1111-1111-1111-111111111006',
    'Chimney Cleaning',
    'chimney-cleaning',
    'Kitchen & Appliances',
    'Baffle/filter dismantling, caustic degreasing, duct inspection, and blower fan cleaning.',
    '["Filter baffle dismantling and ultrasonic degrease bath", "Blower fan motor surface clean", "Exterior stainless steel / glass polishing", "Air suction flow testing"]'::jsonb,
    '["Duct pipe replacement / fresh aluminium duct routing", "Blower motor winding repair"]'::jsonb,
    60,
    5,
    60,
    899.00,
    'Flame'
  ),
  (
    '11111111-1111-1111-1111-111111111007',
    'Mattress Cleaning',
    'mattress-cleaning',
    'Fabric & Upholstery',
    'UV-C sanitization, heavy allergen extraction, and spot shampooing for king/queen mattresses.',
    '["High-suction HEPA dust mite vacuuming", "UV-C ultraviolet ray sanitization", "Organic enzyme spot stain treatment", "Deodorizing mist spray"]'::jsonb,
    '["Mattress drying services (requires 3-4 hours natural air drying)", "Spring repair or internal foam refilling"]'::jsonb,
    45,
    5,
    60,
    649.00,
    'Bed'
  ),
  (
    '11111111-1111-1111-1111-111111111008',
    'Water-Tank Cleaning',
    'water-tank-cleaning',
    'Community & Utilities',
    'High-pressure rotary jet de-sludging, anti-bacterial UV treatment, and vacuum sludge extraction.',
    '["Sludge de-watering and mechanical extraction", "High-pressure rotary jet wall scrubbing", "Anti-bacterial potassium permanganate treatment", "UV sanitization"]'::jsonb,
    '["Structural crack repairs or waterproofing", "Pipe plumbing replacement"]'::jsonb,
    90,
    7,
    120,
    1499.00,
    'Waves'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  inclusions = EXCLUDED.inclusions,
  exclusions = EXCLUDED.exclusions,
  typical_duration_minutes = EXCLUDED.typical_duration_minutes,
  base_price_estimate = EXCLUDED.base_price_estimate,
  icon = EXCLUDED.icon;

