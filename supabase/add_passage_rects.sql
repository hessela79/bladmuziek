-- Migratie: een passage kan voortaan uit meerdere rechthoeken bestaan
-- (bijv. een passage die over twee regels of een pagina-einde loopt),
-- in plaats van precies één.
--
-- Eenmalig te draaien in de Supabase SQL Editor, ná schema.sql (dus als
-- `passages` nog page/x_pct/y_pct/width_pct/height_pct heeft). Bestaande
-- passages behouden hun ene rechthoek: die wordt overgezet naar de
-- nieuwe tabel passage_rects als het eerste (en enige) vak.

create table if not exists passage_rects (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references passages (id) on delete cascade,
  page int not null,
  x_pct numeric not null,
  y_pct numeric not null,
  width_pct numeric not null,
  height_pct numeric not null,
  sort_order int not null default 0
);

alter table passage_rects enable row level security;

create policy "open select passage_rects" on passage_rects for select using (true);
create policy "open insert passage_rects" on passage_rects for insert with check (true);
create policy "open update passage_rects" on passage_rects for update using (true);
create policy "open delete passage_rects" on passage_rects for delete using (true);

insert into passage_rects (passage_id, page, x_pct, y_pct, width_pct, height_pct, sort_order)
select id, page, x_pct, y_pct, width_pct, height_pct, 0
from passages;

alter table passages
  drop column page,
  drop column x_pct,
  drop column y_pct,
  drop column width_pct,
  drop column height_pct;
