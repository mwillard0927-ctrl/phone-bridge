-- Phone Bridge: run once in Supabase → SQL Editor
create table if not exists public.drops (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users on delete cascade,
  user_email text,
  from_phone text,
  kind text not null check (kind in ('text','file')),
  title text, text text,
  name text, size bigint, type text, path text, is_text boolean default false
);
alter table public.drops enable row level security;
create policy "signed-in read"   on public.drops for select to authenticated using (true);
create policy "signed-in insert" on public.drops for insert to authenticated with check (user_id = auth.uid());
create policy "signed-in delete" on public.drops for delete to authenticated using (true);
alter publication supabase_realtime add table public.drops;
alter table public.drops replica identity full;

insert into storage.buckets (id, name, public, file_size_limit)
values ('bridge','bridge',false, 52428800) on conflict (id) do nothing;
create policy "bridge read"   on storage.objects for select to authenticated using (bucket_id = 'bridge');
create policy "bridge upload" on storage.objects for insert to authenticated with check (bucket_id = 'bridge');
create policy "bridge delete" on storage.objects for delete to authenticated using (bucket_id = 'bridge');
