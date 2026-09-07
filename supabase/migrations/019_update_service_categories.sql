-- ==============================================================================
-- Migration: 019_update_service_categories.sql
-- Description: Standardize 12 Service Categories and Remove Chimney, Mattress, Sofa
-- ==============================================================================

-- 1. Remove legacy services: Chimney, Mattress, and Sofa
DELETE FROM public.services
WHERE slug IN ('chimney-cleaning', 'mattress-cleaning', 'sofa-cleaning')
   OR name ILIKE '%chimney%'
   OR name ILIKE '%mattress%'
   OR name ILIKE '%sofa%';

-- 2. Upsert Standardized 12-Category Services Catalog
INSERT INTO public.services (id, name, slug, category, description, inclusions, exclusions, typical_duration_minutes, suggested_campaign_days, suggested_slot_duration_minutes, base_price_estimate, icon)
VALUES
  (
    '11111111-1111-1111-1111-111111111001',
    'AC Servicing & Jet Cleaning',
    'ac-servicing',
    'AC Maintenance & Repair',
    'High-pressure jet-pump filter, cooling coil foam wash, drain tray flush, and gas pressure check.',
    '["Indoor filter jet wash", "Outdoor unit water deep flush", "Drain pipe chemical flush", "Refrigerant pressure diagnostics"]'::jsonb,
    '["Gas refilling (quoted separately)", "PCB circuit repair"]'::jsonb,
    45,
    7,
    60,
    699.00,
    'Wind'
  ),
  (
    '11111111-1111-1111-1111-111111111002',
    'Pest & Cockroach Control',
    'pest-control',
    'Cleaning & Pest Control',
    'Odorless herbal gel baiting and anti-pest spray across all rooms and bathroom drains.',
    '["Kitchen cabinet gel baiting", "Bathroom drain spray", "Perimeter baseboard treatment", "30-day retreat warranty"]'::jsonb,
    '["Termite structural drilling", "Bedbug chemical fogging"]'::jsonb,
    60,
    7,
    90,
    999.00,
    'Bug'
  ),
  (
    '11111111-1111-1111-1111-111111111003',
    'Home Deep Cleaning',
    'deep-cleaning',
    'Cleaning & Pest Control',
    'Full-home mechanized floor scrubbing, kitchen tile degreasing, bathroom descaling, and balcony wash.',
    '["Kitchen tile and countertop degrease", "Bathroom descaling & sanitization", "Floor mechanized single-disc scrubbing", "Window track clean"]'::jsonb,
    '["Appliance interior chemical clean", "Exterior window wash"]'::jsonb,
    240,
    10,
    240,
    2999.00,
    'Sparkles'
  ),
  (
    '11111111-1111-1111-1111-111111111005',
    'RO Purifier Health Check & Service',
    'ro-servicing',
    'Water Purifier & Plumbing',
    'Water purifier filter flush, booster pump pressure check, TDS calibration, and pipeline sanitization.',
    '["Pre-filter candle wash & inspection", "Membrane TDS ppm testing", "Booster pump pressure check", "Internal line flush"]'::jsonb,
    '["RO membrane replacement (billed as per brand)", "SMPS adapter replacement"]'::jsonb,
    45,
    5,
    60,
    499.00,
    'Droplets'
  ),
  (
    '11111111-1111-1111-1111-111111111009',
    'Plumbing Leakage & Tap Repairs',
    'plumbing-repairs',
    'Water Purifier & Plumbing',
    'Comprehensive inspection and fixing of leaking pipes, angle valves, kitchen sink drains, and flush valves.',
    '["Up to 3 tap/valve repairs", "Pipe leakage inspection", "Washer & teflon tape re-sealing"]'::jsonb,
    '["Concealed wall pipeline breaking", "Ceramic basin replacement"]'::jsonb,
    45,
    5,
    60,
    449.00,
    'Wrench'
  ),
  (
    '11111111-1111-1111-1111-111111111010',
    'Electrical Inspection & Geyser Check',
    'geyser-electrical-service',
    'Electrical & Appliances',
    'Water heater geyser descaling, thermostat safety check, MCB test, and general electrical diagnostics.',
    '["Geyser heating element test", "Thermostat auto-cut calibration", "Main switchboard MCB inspection"]'::jsonb,
    '["Geyser tank replacement", "Full-house rewiring"]'::jsonb,
    45,
    5,
    60,
    499.00,
    'Zap'
  ),
  (
    '11111111-1111-1111-1111-111111111011',
    'Doorstep Car Foam Wash & Polish',
    'car-foam-wash',
    'Car & Bike Care',
    'High-pressure foam wash, tyre dressing, interior vacuuming, and dashboard ultraviolet polish in parking bay.',
    '["Exterior foam wash", "Interior footwell & seat vacuuming", "Tyre shine polish", "Dashboard UV coat"]'::jsonb,
    '["Paint scratch buffing / compounding", "Engine bay degreasing"]'::jsonb,
    45,
    5,
    45,
    599.00,
    'Car'
  ),
  (
    '11111111-1111-1111-1111-111111111012',
    'Balcony & Wall Waterproofing',
    'balcony-waterproofing',
    'Painting & Waterproofing',
    'Polymer tile-joint grouting, exterior balcony waterproof coating, and window perimeter sealant.',
    '["Tile joint re-grouting", "Waterproof elastomeric coating", "Window edge silicone sealing"]'::jsonb,
    '["Tile dismantling / screed replacement", "Structural concrete repair"]'::jsonb,
    120,
    7,
    120,
    1499.00,
    'Paintbrush'
  ),
  (
    '11111111-1111-1111-1111-111111111013',
    'Home Carpentry & Fitting Repairs',
    'carpentry-repairs',
    'Home Repair & Carpentry',
    'Door alignment, hydraulic closer installation, hinge lubrication, lock replacement, and wall mounting.',
    '["Up to 3 door / cabinet hinge repairs", "Wall frame/mirror drilling & hanging", "Lock barrel adjustment"]'::jsonb,
    '["Custom furniture building", "Plywood wood-rot replacement"]'::jsonb,
    60,
    5,
    60,
    449.00,
    'Hammer'
  ),
  (
    '11111111-1111-1111-1111-111111111014',
    'Curtain & Carpet Deep Clean',
    'curtain-carpet-cleaning',
    'Home Deep-Care',
    'Dry vacuum extraction, steam sanitization, and spot stain treatment for living room carpets and curtains.',
    '["High-suction HEPA vacuuming", "Steam allergen sanitization", "Fabric deodorizing enzyme mist"]'::jsonb,
    '["Curtain dismantling and re-stitching", "Chemical dry-cleaning requiring factory pickup"]'::jsonb,
    60,
    7,
    60,
    799.00,
    'Sparkles'
  ),
  (
    '11111111-1111-1111-1111-111111111008',
    'Water Tank Mechanical Cleaning',
    'water-tank-cleaning',
    'Society & Common Areas',
    'High-pressure rotary jet de-sludging, sludge vacuuming, potassium permanganate wash, and UV disinfection.',
    '["Sludge de-watering & extraction", "Rotary jet wall scrubbing", "Anti-bacterial treatment", "UV sanitization"]'::jsonb,
    '["Structural crack plastering", "Pipe plumbing rework"]'::jsonb,
    90,
    7,
    120,
    1499.00,
    'Building2'
  ),
  (
    '11111111-1111-1111-1111-111111111015',
    'Pre-Summer AC Drive',
    'summer-ac-drive',
    'Seasonal Services',
    'Mass-society early summer AC inspection, coil descaling, and condenser flush before peak summer tariffs.',
    '["Jet-pump coil wash", "Gas pressure check", "Amperage electrical diagnostic", "Drain flush"]'::jsonb,
    '["Full compressor overhaul", "Copper piping reweld"]'::jsonb,
    45,
    10,
    45,
    649.00,
    'Sun'
  ),
  (
    '11111111-1111-1111-1111-111111111016',
    'Annual AC Maintenance Contract (AMC)',
    'ac-amc-plan',
    'Annual Maintenance Plans',
    'Year-round care: 2 comprehensive wet jet-washes, unlimited priority breakdown visits, and free labor.',
    '["2 scheduled wet services per year", "Unlimited breakdown callouts", "Electrical switch and sensor checks"]'::jsonb,
    '["Refrigerant gas refill and compressor spare parts"]'::jsonb,
    60,
    14,
    60,
    1999.00,
    'ShieldCheck'
  ),
  (
    '11111111-1111-1111-1111-111111111017',
    'Balcony Mosquito Netting & Mesh',
    'mosquito-net-installation',
    'Renovation & Home Upgrades',
    'Custom-fitted stainless steel / fiberglass mesh netting for balconies and bedroom sliding windows.',
    '["Aluminum frame custom sizing", "Stainless steel anti-rust mesh", "Heavy-duty magnetic / velcro latches"]'::jsonb,
    '["Balcony grill structural fabrication"]'::jsonb,
    90,
    10,
    90,
    1899.00,
    'Layers'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  inclusions = EXCLUDED.inclusions,
  exclusions = EXCLUDED.exclusions,
  typical_duration_minutes = EXCLUDED.typical_duration_minutes,
  suggested_campaign_days = EXCLUDED.suggested_campaign_days,
  suggested_slot_duration_minutes = EXCLUDED.suggested_slot_duration_minutes,
  base_price_estimate = EXCLUDED.base_price_estimate,
  icon = EXCLUDED.icon;
