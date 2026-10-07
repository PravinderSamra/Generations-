# Generations: project plan

## 1. What we're building

A **video family tree**. Families branch into members, laid out by generation. Each member has:

- **About**: photo, one-line description, born, from, and a bio.
- **Videos**: one-tap upload (camera roll or record on a phone, file picker or drag-and-drop on a computer), with title, description, filming date and uploader.

The goal is that future generations see and hear their ancestors first-hand.

Design direction: **"rich soil, polished glass"**. That means warm earth tones (umber, ochre, terracotta, sage), glossy layered surfaces, a serif display face (Fraunces) and a soft grain texture. It should feel like an heirloom, not a template. There is a light and a dark theme. On phones the main navigation is an app-style bottom tab bar with a central "+" upload button. On desktop it is a glass top bar plus a ⌘K / "/" search for jumping to anyone.

## 2. Improvements on the original idea

**Built into this first draft:**
- Tree layout grouped by generation. Partners are linked with a heart, and curved "root" lines run from parents to children. There is also a toggle to an "Everyone" grid.
- Profile pages show relationship chips for parents, partner, siblings and children, so you can walk the tree from person to person.
- **Story prompts** in the upload window ("Where I grew up", "How we met", "Advice for the future"…). They help people who freeze on camera.
- Auto-generated thumbnails and duration. "Filmed on" date is kept separate from upload date.
- **Paste a YouTube/Vimeo link** for long videos. This gets around free-tier file size limits.
- Search across all members.
- A storage layer you can swap: browser-only preview now, shared Supabase backend by changing one setting.
- An installable web-app manifest, so it can be added to a phone's home screen.

**Recommended next (roadmap):**
1. **Real relationships**: confirm the actual family structure (the current tree is a placeholder), then add an in-app "add family member" flow.
2. **Shared backend**: turn on Supabase with email magic-link sign-in so only invited family can view or upload.
3. **Interview mode**: a guided recording session that shows one prompt at a time, e.g. for recording grandparents.
4. **Tag multiple people** in one video so it appears on everyone's page.
5. **Timeline view**: every video ordered by the year it was filmed.
6. **Captions and transcripts**: free in-browser speech-to-text. Makes videos searchable and accessible, and keeps words even if a video file is lost.
7. **Time capsule videos**: "unlock for Delilah on her 18th birthday".
8. **Preservation**: periodic export or backup of all videos (e.g. to Google Drive) so the archive outlives any one service.
9. Client-side compression of large phone videos before upload.

## 3. Tools: MCPs and connectors (all free)

| Tool | Use |
|---|---|
| **Playwright MCP** (or the Playwright already in the cloud container, used for this draft) | Mobile and desktop screenshots, end-to-end upload tests, a visual critique loop |
| **Chrome DevTools MCP** | Console and network debugging, Lighthouse performance and accessibility audits |
| **Supabase MCP** | Create tables, security rules and storage buckets directly (scope it to the one project) |
| **Context7** | Up-to-date library docs (supabase-js, web APIs) |
| **GitHub MCP** (already connected) | Branches, PRs, Pages deploy checks |
| a11y-mcp (axe-core) | Optional WCAG checks |

Skipped: **Figma MCP**. The free plan only allows a handful of tool calls a month. Firebase Storage needs the paid Blaze plan, and Cloudflare R2 asks for a card.

## Model split (to save tokens)

| Task | Model |
|---|---|
| Product review, UX analysis, architecture, design system and main build | Opus |
| Researching which MCPs and hosting options are free | Sonnet (sub-agent) |
| Good candidates to delegate later: writing bios or copy, bulk data entry, routine screenshot QA, docs tidy-ups | Haiku or Sonnet |
