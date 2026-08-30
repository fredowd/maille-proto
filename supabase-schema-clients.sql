-- ============================================================
-- MAILLE — Migration : portfolio clients par organisation
-- À exécuter APRÈS les migrations précédentes, dans SQL Editor > Run
-- ============================================================

-- Chaque client appartient à UNE SEULE organisation. Un même nom de
-- client peut exister dans plusieurs organisations sans lien entre
-- elles : aucune table partagée = aucune visibilité croisée possible.
create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  contact_email text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table clients enable row level security;

create policy "clients: voir ceux de son org" on clients
  for select using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "clients: creer dans son org" on clients
  for insert with check (org_id in (select org_id from profiles where id = auth.uid()));

create policy "clients: modifier ceux de son org" on clients
  for update using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "clients: supprimer ceux de son org" on clients
  for delete using (org_id in (select org_id from profiles where id = auth.uid()));

-- ------------------------------------------------------------
-- Lier les commandes à un client de portfolio plutôt qu'à du texte libre
-- ------------------------------------------------------------
alter table styles add column client_id uuid references clients(id) on delete set null;

-- La colonne "client" (texte libre) existante est conservée pour ne pas
-- perdre les données de test déjà saisies, mais n'est plus utilisée par
-- l'application à partir de maintenant.

-- Fin de la migration.
