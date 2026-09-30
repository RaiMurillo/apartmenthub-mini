-- seed.sql: sample listings so the site has something to show.
-- Run in the Supabase SQL editor after the migrations.

insert into public.listings (title, city, rent_eur, bedrooms, description_nl, description_en) values
  ('Lichte studio bij het Centraal Station', 'Utrecht', 1150, 0,
   'Compacte, lichte studio op loopafstand van het station. Inclusief eigen keuken en badkamer.',
   'Compact, bright studio within walking distance of the station. Includes private kitchen and bathroom.'),
  ('Ruim 2-kamerappartement met balkon', 'Amsterdam', 1850, 1,
   'Rustig gelegen appartement met zonnig balkon, vlak bij het Vondelpark en openbaar vervoer.',
   'Quietly located apartment with a sunny balcony, close to Vondelpark and public transport.'),
  ('Gezinswoning met tuin', 'Eindhoven', 2100, 3,
   'Ruime gezinswoning met achtertuin, drie slaapkamers en een berging. Scholen in de buurt.',
   'Spacious family home with a back garden, three bedrooms and a storage room. Schools nearby.'),
  ('Modern appartement aan het water', 'Rotterdam', 1650, 2,
   'Nieuwbouwappartement met uitzicht over de Maas, vloerverwarming en een eigen parkeerplek.',
   'New-build apartment overlooking the Maas, with underfloor heating and a private parking space.');

-- To make yourself an admin (after signing up in the app), run:
--   update public.profiles set role = 'admin' where id = '<your user id>';
-- Your user id is in Supabase dashboard -> Authentication -> Users.
