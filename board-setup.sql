-- Project Boards (shared by Phone Bridge + Bridge Hub). Run once in Supabase → SQL Editor.

create table if not exists public.hub_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  username text not null,
  updated_at timestamptz default now()
);
create table if not exists public.hub_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.hub_members (
  project_id uuid references public.hub_projects on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create table if not exists public.hub_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.hub_projects on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  body text check (char_length(body) <= 50000),
  tag text default 'Note',
  status text not null default 'open' check (status in ('open','resolved')),
  pinned boolean not null default false,
  due date,
  file_path text, file_name text, file_size bigint, file_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hub_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hub_posts on delete cascade,
  project_id uuid not null references public.hub_projects on delete cascade,
  parent_id uuid references public.hub_replies on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 20000),
  file_path text, file_name text, file_size bigint, file_type text,
  created_at timestamptz not null default now()
);
create table if not exists public.hub_views (
  post_id uuid references public.hub_posts on delete cascade,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  project_id uuid references public.hub_projects on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists hub_posts_project on public.hub_posts(project_id);
create index if not exists hub_replies_post on public.hub_replies(post_id);
create index if not exists hub_views_project on public.hub_views(project_id);

-- helpers (security definer so policies don't recurse)
create or replace function public.hub_is_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from hub_members where project_id = p and user_id = auth.uid());
$$;
create or replace function public.hub_is_admin(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from hub_members where project_id = p and user_id = auth.uid() and role = 'admin');
$$;
create or replace function public.hub_is_member_text(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from hub_members where project_id::text = p and user_id = auth.uid());
$$;
create or replace function public.hub_create_project(p_name text) returns public.hub_projects
language plpgsql security definer set search_path = public as $$
declare r hub_projects;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into hub_projects(name, invite_code, owner)
  values (trim(p_name), upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), auth.uid())
  returning * into r;
  insert into hub_members(project_id, user_id, role) values (r.id, auth.uid(), 'admin');
  return r;
end $$;
create or replace function public.hub_join_project(p_code text) returns public.hub_projects
language plpgsql security definer set search_path = public as $$
declare r hub_projects;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into r from hub_projects where invite_code = upper(trim(p_code));
  if r.id is null then raise exception 'No project with that code'; end if;
  insert into hub_members(project_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  return r;
end $$;

alter table public.hub_profiles enable row level security;
alter table public.hub_projects enable row level security;
alter table public.hub_members  enable row level security;
alter table public.hub_posts    enable row level security;
alter table public.hub_replies  enable row level security;
alter table public.hub_views    enable row level security;

grant select, insert, update on public.hub_profiles to authenticated;
grant select, update, delete on public.hub_projects to authenticated;
grant select, update, delete on public.hub_members  to authenticated;
grant select, insert, update, delete on public.hub_posts   to authenticated;
grant select, insert, delete on public.hub_replies to authenticated;
grant select, insert on public.hub_views to authenticated;
grant execute on function public.hub_is_member(uuid), public.hub_is_admin(uuid), public.hub_is_member_text(text),
  public.hub_create_project(text), public.hub_join_project(text) to authenticated;

create policy "profiles read"   on public.hub_profiles for select to authenticated using (true);
create policy "profiles own"    on public.hub_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "profiles own up" on public.hub_profiles for update to authenticated using (user_id = auth.uid());

create policy "projects read"   on public.hub_projects for select to authenticated using (hub_is_member(id));
create policy "projects admin"  on public.hub_projects for update to authenticated using (hub_is_admin(id));
create policy "projects delete" on public.hub_projects for delete to authenticated using (hub_is_admin(id));

create policy "members read"    on public.hub_members for select to authenticated using (hub_is_member(project_id));
create policy "members admin"   on public.hub_members for update to authenticated using (hub_is_admin(project_id));
create policy "members remove"  on public.hub_members for delete to authenticated using (hub_is_admin(project_id) or user_id = auth.uid());

create policy "posts read"   on public.hub_posts for select to authenticated using (hub_is_member(project_id));
create policy "posts add"    on public.hub_posts for insert to authenticated with check (hub_is_member(project_id) and user_id = auth.uid());
create policy "posts edit"   on public.hub_posts for update to authenticated using (user_id = auth.uid() or hub_is_admin(project_id));
create policy "posts delete" on public.hub_posts for delete to authenticated using (user_id = auth.uid() or hub_is_admin(project_id));

create policy "replies read"   on public.hub_replies for select to authenticated using (hub_is_member(project_id));
create policy "replies add"    on public.hub_replies for insert to authenticated with check (hub_is_member(project_id) and user_id = auth.uid());
create policy "replies delete" on public.hub_replies for delete to authenticated using (user_id = auth.uid() or hub_is_admin(project_id));

create policy "views read" on public.hub_views for select to authenticated using (hub_is_member(project_id));
create policy "views add"  on public.hub_views for insert to authenticated with check (user_id = auth.uid() and hub_is_member(project_id));

alter publication supabase_realtime add table public.hub_posts, public.hub_replies, public.hub_views, public.hub_members;
alter table public.hub_posts   replica identity full;
alter table public.hub_replies replica identity full;
alter table public.hub_members replica identity full;

insert into storage.buckets (id, name, public, file_size_limit)
values ('boards','boards',false, 10485760) on conflict (id) do nothing;
create policy "boards read"   on storage.objects for select to authenticated using (bucket_id='boards' and hub_is_member_text((storage.foldername(name))[1]));
create policy "boards upload" on storage.objects for insert to authenticated with check (bucket_id='boards' and hub_is_member_text((storage.foldername(name))[1]));
create policy "boards delete" on storage.objects for delete to authenticated using (bucket_id='boards' and hub_is_member_text((storage.foldername(name))[1]));
