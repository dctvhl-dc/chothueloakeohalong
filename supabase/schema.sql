-- Supabase schema for public website content and media.
-- Admin writes go through the authenticated Apps Script API; never expose service_role.

create table if not exists public.website_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('post', 'review', 'gallery')),
  title text not null default '',
  summary text not null default '',
  content text not null default '',
  url text not null default '',
  image_url text not null default '',
  author text not null default '',
  status text not null default 'published' check (status in ('published', 'draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_content_public_order
  on public.website_content (kind, status, created_at desc);

create table if not exists public.website_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.website_content enable row level security;
alter table public.website_settings enable row level security;

drop policy if exists "Published website content is readable" on public.website_content;
create policy "Published website content is readable"
  on public.website_content for select to anon, authenticated
  using (status = 'published');

drop policy if exists "Website settings are readable" on public.website_settings;
create policy "Website settings are readable"
  on public.website_settings for select to anon, authenticated
  using (true);

grant select on public.website_content, public.website_settings to anon, authenticated;
revoke insert, update, delete on public.website_content, public.website_settings from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-images',
  'website-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Website images are publicly readable" on storage.objects;
create policy "Website images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'website-images');