-- Generations: Supabase schema. Paste into Supabase → SQL Editor → Run.
-- Only signed-in users (family members you invite) can read or write.

create table if not exists public.members (
  id          text primary key,          -- matches ids in site/data/families.json
  bio         text,
  tagline     text,
  born        text,
  place       text,
  photo_path  text,
  updated_at  timestamptz default now()
);

create table if not exists public.videos (
  id           uuid primary key default gen_random_uuid(),
  member_id    text not null,
  title        text not null,
  description  text,
  recorded_on  date,
  duration     real,
  storage_path text,                      -- null when the video is an external link
  thumb_path   text,
  external_url text,                      -- YouTube / Vimeo link for long videos
  uploaded_by  text,
  created_at   timestamptz default now()
);
create index if not exists videos_member_idx on public.videos (member_id, created_at desc);

alter table public.members enable row level security;
alter table public.videos  enable row level security;

create policy "family can read members"  on public.members for select to authenticated using (true);
create policy "family can write members" on public.members for insert to authenticated with check (true);
create policy "family can edit members"  on public.members for update to authenticated using (true);

create policy "family can read videos"   on public.videos for select to authenticated using (true);
create policy "family can add videos"    on public.videos for insert to authenticated with check (true);
create policy "family can edit videos"   on public.videos for update to authenticated using (true);
create policy "family can delete videos" on public.videos for delete to authenticated using (true);

-- Private storage bucket for video files, thumbnails and profile photos.
insert into storage.buckets (id, name, public) values ('videos', 'videos', false)
on conflict (id) do nothing;

create policy "family can read files"   on storage.objects for select to authenticated using (bucket_id = 'videos');
create policy "family can upload files" on storage.objects for insert to authenticated with check (bucket_id = 'videos');
create policy "family can update files" on storage.objects for update to authenticated using (bucket_id = 'videos');
create policy "family can delete files" on storage.objects for delete to authenticated using (bucket_id = 'videos');
