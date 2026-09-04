-- Eenmalig te draaien in de Supabase SQL Editor.
--
-- 1) Voegt sort_order toe aan pieces, zodat de volgorde in het
--    beheerscherm (en straks de homepage) versleept kan worden.
--    Bestaande stukken krijgen een volgorde op basis van created_at,
--    zodat er niets door elkaar springt.
-- 2) Zet RLS aan op de 3 tabellen met expliciete policies, in plaats
--    van RLS helemaal uit te laten staan. Voorlopig zijn de policies
--    nog volledig open (zelfde toegang als nu), maar dit is de
--    structuur waarin je straks eenvoudig een echt rechtenniveau kunt
--    zetten door "using (true)" te vervangen door bijvoorbeeld
--    "using (auth.role() = 'authenticated')".

-- ---------- 1) Volgorde voor stukken ----------

alter table pieces add column if not exists sort_order int not null default 0;

with numbered as (
  select id, row_number() over (order by created_at) - 1 as rn
  from pieces
)
update pieces
set sort_order = numbered.rn
from numbered
where pieces.id = numbered.id;

-- ---------- 2) RLS aanzetten met (voorlopig) open policies ----------

alter table assets enable row level security;
alter table pieces enable row level security;
alter table passages enable row level security;

drop policy if exists "open select assets" on assets;
drop policy if exists "open insert assets" on assets;
drop policy if exists "open update assets" on assets;
drop policy if exists "open delete assets" on assets;
create policy "open select assets" on assets for select using (true);
create policy "open insert assets" on assets for insert with check (true);
create policy "open update assets" on assets for update using (true);
create policy "open delete assets" on assets for delete using (true);

drop policy if exists "open select pieces" on pieces;
drop policy if exists "open insert pieces" on pieces;
drop policy if exists "open update pieces" on pieces;
drop policy if exists "open delete pieces" on pieces;
create policy "open select pieces" on pieces for select using (true);
create policy "open insert pieces" on pieces for insert with check (true);
create policy "open update pieces" on pieces for update using (true);
create policy "open delete pieces" on pieces for delete using (true);

drop policy if exists "open select passages" on passages;
drop policy if exists "open insert passages" on passages;
drop policy if exists "open update passages" on passages;
drop policy if exists "open delete passages" on passages;
create policy "open select passages" on passages for select using (true);
create policy "open insert passages" on passages for insert with check (true);
create policy "open update passages" on passages for update using (true);
create policy "open delete passages" on passages for delete using (true);
