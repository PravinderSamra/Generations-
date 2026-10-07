# Generations

A video-based family tree. Each family member has a page with their bio and videos of them, uploaded from a phone or computer, so that future generations can see first-hand who their ancestors were.

## Project layout

```
site/                    ← the whole website (upload this folder to any host)
  index.html
  assets/css/styles.css  ← design system (colours, glass, type)
  assets/js/app.js       ← pages: home, family tree, member (About / Videos), upload
  assets/js/config.js    ← switch storage mode / add Supabase keys here
  assets/js/store/       ← storage backends: local (browser) and supabase
  data/families.json     ← families, members, generations, relationships
supabase/schema.sql      ← database + storage setup for the shared archive
docs/PLAN.md             ← review, improvements, roadmap, tooling
docs/HOSTING.md          ← GitHub Pages, Supabase, moving hosts
```

## Run it locally

```bash
cd site && python3 -m http.server 8000
# open http://localhost:8000
```

## Editing the family

Edit `site/data/families.json`. For each member you can set:

- `generation`: 1 is the eldest.
- `parents`: a list of member ids.
- `partner`: one member id.

Bios, photos and details can also be edited on the site with **Edit profile**.

## Storage modes

- **Preview (default):** videos are saved in the browser that uploaded them. Nothing leaves the device.
- **Shared:** a free Supabase project, so the whole family sees everything after an email sign-in. See [docs/HOSTING.md](docs/HOSTING.md).
