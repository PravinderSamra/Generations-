// Site configuration. This is the only file you need to edit when moving hosts
// or switching on the shared backend.
export const config = {
  siteName: 'Generations',

  // 'local'    – videos are saved in this browser only (IndexedDB). Great for
  //              trying the site out; nothing leaves the device.
  // 'supabase' – videos, bios and photos are shared with the whole family via a
  //              free Supabase project. See docs/HOSTING.md.
  storage: 'local',

  supabase: {
    url: '',      // e.g. https://abcd1234.supabase.co
    anonKey: '',  // Project settings → API → anon public key
    bucket: 'videos',
    // Require family members to sign in (email magic link) before viewing.
    requireSignIn: true,
  },

  // Largest single upload accepted, in MB. Supabase free tier caps files at 50 MB.
  maxUploadMB: 500,
};
