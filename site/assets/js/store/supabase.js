// Shared storage on a free Supabase project: Postgres for metadata, Storage for
// the video files, email magic-link sign-in so only family can see the archive.
// Set-up steps live in docs/HOSTING.md and supabase/schema.sql.

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const SIGNED_URL_TTL = 60 * 60 * 6; // seconds

export async function createSupabaseStore(config) {
  const { createClient } = await import(SDK);
  const cfg = config.supabase;
  const sb = createClient(cfg.url, cfg.anonKey);
  const bucket = sb.storage.from(cfg.bucket);
  let session = null;

  async function sign(paths) {
    const wanted = paths.filter(Boolean);
    if (!wanted.length) return {};
    const { data, error } = await bucket.createSignedUrls(wanted, SIGNED_URL_TTL);
    if (error) throw error;
    return Object.fromEntries(data.map((d) => [d.path, d.signedUrl]));
  }

  // supabase-js has no upload progress, so upload with XHR against the REST API.
  function putObject(path, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${cfg.url}/storage/v1/object/${cfg.bucket}/${encodeURI(path)}`);
      xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token || cfg.anonKey}`);
      xhr.setRequestHeader('apikey', cfg.anonKey);
      xhr.setRequestHeader('x-upsert', 'true');
      if (file.type) xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(parseError(xhr))));
      xhr.onerror = () => reject(new Error('Network error while uploading.'));
      xhr.send(file);
    });
  }

  const ext = (file, fallback) => (file.name?.split('.').pop() || fallback).toLowerCase();

  return {
    mode: 'supabase',
    maxUploadMB: Math.min(config.maxUploadMB, 50),

    async init() {
      const { data } = await sb.auth.getSession();
      session = data.session;
      sb.auth.onAuthStateChange((_e, s) => { session = s; });
    },

    needsSignIn: () => cfg.requireSignIn && !session,
    user: () => session?.user || null,

    async signIn(email) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.href.split('#')[0] },
      });
      if (error) throw error;
    },

    async signOut() { await sb.auth.signOut(); session = null; },

    async memberOverrides() {
      const { data, error } = await sb.from('members').select('*');
      if (error) throw error;
      const urls = await sign(data.map((r) => r.photo_path));
      return Object.fromEntries(data.map((r) => [r.id, {
        bio: r.bio, tagline: r.tagline, born: r.born, place: r.place,
        photoUrl: urls[r.photo_path] || '',
      }]));
    },

    async updateMember(memberId, patch, photoFile) {
      const row = { id: memberId, ...patch, updated_at: new Date().toISOString() };
      if (photoFile) {
        const path = `photos/${memberId}-${Date.now()}.${ext(photoFile, 'jpg')}`;
        await putObject(path, photoFile);
        row.photo_path = path;
      }
      const { error } = await sb.from('members').upsert(row);
      if (error) throw error;
    },

    async videoCounts() {
      const { data, error } = await sb.from('videos').select('member_id');
      if (error) throw error;
      const counts = {};
      for (const r of data) counts[r.member_id] = (counts[r.member_id] || 0) + 1;
      return counts;
    },

    async listVideos(memberId) {
      const { data, error } = await sb.from('videos').select('*')
        .eq('member_id', memberId).order('created_at', { ascending: false });
      if (error) throw error;
      const urls = await sign(data.flatMap((r) => [r.storage_path, r.thumb_path]));
      return data.map((r) => ({
        id: r.id,
        memberId: r.member_id,
        title: r.title,
        description: r.description,
        recordedOn: r.recorded_on,
        createdAt: r.created_at,
        duration: r.duration,
        uploadedBy: r.uploaded_by,
        link: r.external_url || '',
        url: urls[r.storage_path] || '',
        thumbUrl: urls[r.thumb_path] || '',
        _paths: [r.storage_path, r.thumb_path].filter(Boolean),
      }));
    },

    async uploadVideo(memberId, file, meta, thumb, onProgress) {
      const id = crypto.randomUUID();
      let storage_path = null;
      if (file) {
        storage_path = `videos/${memberId}/${id}.${ext(file, 'mp4')}`;
        await putObject(storage_path, file, (p) => onProgress?.(p * 0.95));
      }
      let thumb_path = null;
      if (thumb) {
        thumb_path = `thumbs/${memberId}/${id}.jpg`;
        await putObject(thumb_path, thumb).catch(() => { thumb_path = null; });
      }
      const { error } = await sb.from('videos').insert({
        id, member_id: memberId, storage_path, thumb_path, external_url: meta.link || null,
        title: meta.title, description: meta.description,
        recorded_on: meta.recordedOn || null, duration: meta.duration || null,
        uploaded_by: meta.uploadedBy || session?.user?.email || null,
      });
      if (error) throw error;
      onProgress?.(1);
    },

    async updateVideo(id, patch) {
      const { error } = await sb.from('videos').update({
        title: patch.title, description: patch.description, recorded_on: patch.recordedOn || null,
      }).eq('id', id);
      if (error) throw error;
    },

    async deleteVideo(id, video) {
      if (video?._paths?.length) await bucket.remove(video._paths);
      const { error } = await sb.from('videos').delete().eq('id', id);
      if (error) throw error;
    },
  };
}

function parseError(xhr) {
  try { return JSON.parse(xhr.responseText).message || `Upload failed (${xhr.status})`; }
  catch { return `Upload failed (${xhr.status})`; }
}
