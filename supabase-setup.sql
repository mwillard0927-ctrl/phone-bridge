-- Phone Bridge: run once in Supabase → SQL Editor (safe to add to an existing project)
create table if not exists public.bridge_members (email text primary key);
alter table public.bridge_members enable row level security;

create or replace function public.is_bridge_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bridge_members where lower(email) = lower(auth.jwt()->>'email'));
$$;

create table if not exists public.bridge_drops (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users on delete cascade,
  user_email text,
  from_phone text,
  kind text not null check (kind in ('text','file')),
  title text, text text,
  name text, size bigint, type text, path text, is_text boolean default false
);
alter table public.bridge_drops enable row level security;
create policy "bridge members read"   on public.bridge_drops for select to authenticated using (public.is_bridge_member());
create policy "bridge members insert" on public.bridge_drops for insert to authenticated with check (public.is_bridge_member() and user_id = auth.uid());
create policy "bridge members delete" on public.bridge_drops for delete to authenticated using (public.is_bridge_member());
alter publication supabase_realtime add table public.bridge_drops;
alter table public.bridge_drops replica identity full;

insert into storage.buckets (id, name, public, file_size_limit)
values ('bridge','bridge',false, 52428800) on conflict (id) do nothing;
create policy "bridge files read"   on storage.objects for select to authenticated using (bucket_id = 'bridge' and public.is_bridge_member());
create policy "bridge files upload" on storage.objects for insert to authenticated with check (bucket_id = 'bridge' and public.is_bridge_member());
create policy "bridge files delete" on storage.objects for delete to authenticated using (bucket_id = 'bridge' and public.is_bridge_member());

-- Who can use Phone Bridge (add a line per person):
insert into public.bridge_members (email) values ('YOUR-EMAIL@example.com') on conflict do nothing;
