-- ============================================================
-- MAILLE — Schéma Supabase (prototype public de test)
-- À exécuter dans : Supabase > SQL Editor > New query > Run
-- ============================================================

-- Organisations (tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Profils utilisateurs (1 par compte auth, rattaché à une org)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  full_name text,
  role text not null default 'admin_org'
    check (role in ('super_admin','admin_org','utilisateur','lecture_seule')),
  created_at timestamptz default now()
);

-- Styles / commandes suivies
create table styles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  style_ref text not null,
  style_name text not null,
  client text,
  stage text not null default 'Coupe'
    check (stage in ('Coupe','Couture','Finition','Expedition','Cloture')),
  status text not null default 'ontime'
    check (status in ('ontime','risk','late')),
  target_date date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Auto-provisioning : à chaque inscription, on crée
-- automatiquement une organisation + un profil admin_org
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name)
  values (coalesce(new.raw_user_meta_data->>'factory_name', 'Organisation sans nom'))
  returning id into new_org_id;

  insert into profiles (id, org_id, full_name, role)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'admin_org'
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- Row Level Security — isolation stricte par organisation
-- ------------------------------------------------------------
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table styles enable row level security;

create policy "voir sa propre organisation" on organizations
  for select using (id in (select org_id from profiles where id = auth.uid()));

create policy "voir son propre profil" on profiles
  for select using (id = auth.uid());

create policy "modifier son propre profil" on profiles
  for update using (id = auth.uid());

create policy "styles: voir ceux de son org" on styles
  for select using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "styles: creer dans son org" on styles
  for insert with check (org_id in (select org_id from profiles where id = auth.uid()));

create policy "styles: modifier ceux de son org" on styles
  for update using (org_id in (select org_id from profiles where id = auth.uid()));

create policy "styles: supprimer ceux de son org" on styles
  for delete using (org_id in (select org_id from profiles where id = auth.uid()));

-- Fin du script.
