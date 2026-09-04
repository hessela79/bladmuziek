-- Eenmalig te draaien in de Supabase SQL Editor.
--
-- Voegt een "color"-kolom toe aan passages, zodat je per passage een
-- kleur kan kiezen (geel, groen, rood, blauw, bruin, goud) die wordt
-- toegepast op de rand en (transparante) achtergrond van het vakje —
-- zowel in het beheer, bij de gebruiker als in de export.
--
-- Bestaande passages krijgen een startkleur die aansluit bij het oude
-- onderscheid: "goud" voor passages met een oefenfragment, "bruin"
-- voor passages die alleen een opmerking zijn. Dat kan daarna gewoon
-- gewijzigd worden via de kleurkeuze in het beheer.

alter table passages
  add column if not exists color text not null default 'goud';

alter table passages
  drop constraint if exists passages_color_check;

alter table passages
  add constraint passages_color_check
  check (color in ('geel', 'groen', 'rood', 'blauw', 'bruin', 'goud'));

update passages
set color = 'bruin'
where audio_asset_id is null;
