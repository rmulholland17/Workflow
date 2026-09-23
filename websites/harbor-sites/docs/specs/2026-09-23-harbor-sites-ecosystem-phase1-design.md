# Harbor Sites Ecosystem — Phase 1 Design

**Date:** 2026-09-23
**Scope:** Sub-projects #1 (deployment + working intake) and #2 (lead pipeline tracker) of the larger Harbor Sites ecosystem. Sub-projects #3 (sample-generation workflow), #4 (full-build + domain handoff), and #5 (subscription/upkeep billing) are explicitly out of scope for this phase.

## Business context

Harbor Sites builds free sample homepages for local San Diego businesses that don't have a website, then offers to build and host the full site (with the domain registered in the client's name) plus an ongoing maintenance subscription.

The full lead lifecycle:

1. Source prospects via **No-Site Finder** (6,025 SD-area businesses with no website)
2. Call or visit in person; pitch the idea
3. If interested, direct them to the live Harbor Sites site to complete the questionnaire
4. Receive their answers; draft a quick sample homepage from it
5. If they like it, build the full site
6. Register the domain in the client's name (they keep it even if they leave Harbor Sites)
7. Offer a subscription to maintain/host the site going forward

This phase covers the two pieces everything else depends on: getting the site genuinely live with a working intake form, and turning the static No-Site Finder directory into a real pipeline tool that remembers what's been done with each lead.

## Current state (as of this design)

- **Harbor Sites** exists as a private Claude artifact (`index.html`, `questionnaire.html`, `thank-you.html`, `style.css`) and as a stale local copy at `Business/Website Development/websites/harbor-sites/` (path updated 2026-09-23 when Riley had all per-site project folders moved under a new `websites/` subfolder for organization — content unaffected, only the path changed). It is not deployed anywhere with a real URL.
- `questionnaire.html` is already coded for Netlify Forms (`data-netlify="true"`, hidden `form-name` field, honeypot field, `action="/thank-you.html"`) but since the site isn't hosted on Netlify, submissions currently go nowhere.
- **No-Site Finder** is a static artifact: a hardcoded JS array of 6,025 businesses (name, category, city, phone, address, rating, review count, website-presence flag, Google place ID) with client-side search/filter. It has no memory of which businesses have been contacted.
- **No-Site Register** is a smaller (30-business), hand-verified static shortlist with the same shape. Per decision below, it is retired once the Finder gets pipeline tracking.

## Goals

- Harbor Sites is reachable at a real URL and a submitted questionnaire reliably reaches Riley (dashboard + email notification).
- No-Site Finder remembers, per business, where it stands in the pipeline — persisted across sessions and devices, not just the browser's local storage.
- Marking a business "Not a Fit" removes it from the default working view so it's never re-surfaced by accident, without being an unrecoverable delete.

## Non-goals (deferred to later phases)

- Automating the sample-homepage draft itself (#3)
- Domain registration / full-site build tooling (#4)
- Subscription billing (#5)
- Automatically linking a Netlify form submission to its matching row in the tracker (v1 is a manual match by business name/phone)
- A custom domain for Harbor Sites (starting on Netlify's free subdomain; adding a custom domain later is a config change, not a redesign)

## Architecture

### Sub-project #1 — Deployment + intake

**Source of truth:** the local folder `Business/Website Development/websites/harbor-sites/` becomes the deploy source going forward. It will be synced to match the current Claude artifact's content (headline, sources-toggle, etc.) before first deploy. The Claude artifact can remain as a convenience preview link but is no longer authoritative once deployment starts.

**Deploy mechanism:** Netlify, via the Netlify CLI, deployed directly from the local folder (no git repo required for this). Netlify auto-detects the `data-netlify="true"` form on build/deploy — no backend code needed.

**Manual steps on Riley's side** (cannot be done by an agent):
- Create a free Netlify account and authenticate the CLI (`netlify login`, opens a browser)
- After first deploy, enable email notifications for form submissions in the Netlify dashboard (Forms → Settings → notifications)

**Everything else** (running `netlify deploy`, verifying the deployed site, checking form detection) is driven from Claude Code once the account/login step is done.

**Data flow:** visitor fills out the form on the live site → Netlify stores the submission and emails Riley → Riley manually matches it to a business in the pipeline tracker (#2) and marks it *Questionnaire Received*.

### Sub-project #2 — Lead pipeline tracker (No-Site Finder evolution)

No-Site Finder's existing 6,025-row dataset stays a static, embedded snapshot (it doesn't need to be "live" — it was a point-in-time scrape). A new persistent layer is added on top of it rather than migrating the whole dataset into a database:

- **Storage:** the Artifact `db` capability (a small shared database attached to the artifact itself), added to the No-Site Finder artifact.
- **Data model:** one collection (e.g. `leads`), one document per business, keyed by the Google place ID already present in the static data (`id` field). Document shape:
  ```
  {
    status: "uncalled" | "contacted_interested" | "questionnaire_sent" |
            "questionnaire_received" | "sample_drafted" | "sample_sent" |
            "won" | "subscribed" | "not_fit",
    notes: string,       // free text, optional
    updated_at: string   // ISO timestamp, set on every write
  }
  ```
  Businesses with no document default to `"uncalled"` — most of the 6,025 will never get a row written, which keeps the database small.
- **Read path:** on page load, query the `leads` collection and merge statuses into the in-memory `DATA` array by matching `id`.
- **Write path:** a status control on each result card writes to the `leads` collection (`set`/`update`) on click.
- **Default view:** businesses with status `not_fit` are hidden from the normal search/filter results. A "Show excluded" toggle reveals them with a way to restore (set status back to `uncalled` or whatever it was) — a misclick is always recoverable.
- **Notes field:** a small free-text field per business for call notes ("left voicemail," "call back Tuesday"), shown/edited alongside the status control.
- **Filtering:** in addition to existing trade/city filters, add a status filter so Riley can pick up where he left off (e.g. jump straight to everything marked `contacted_interested` with no questionnaire yet).

**No-Site Register:** retired. Nothing from it needs to be preserved — its 30 businesses are a subset of what's discoverable in the Finder, which now has status tracking the Register never had.

## Error handling / edge cases

- **Misclick on "Not a Fit":** never a hard delete — always recoverable via "Show excluded" + restore.
- **Stale local vs. artifact copy:** resolved once by syncing local files before first deploy; from that point the local folder is authoritative and the artifact is not edited independently.
- **Form spam:** honeypot field already present; Netlify's built-in spam filtering is enabled by default. No additional work planned unless spam becomes a real problem post-launch.
- **Netlify free-tier form submission limits:** 100/month on the free tier, far above what this phase needs. Noted only as a future consideration if volume grows.
- **Matching a Netlify submission to a tracker row:** manual in this phase (by business name/phone) — no automatic linkage. Flagged as a natural candidate for a later automation once real volume shows the matching is tedious.

## Testing plan

1. Deploy to Netlify; submit the live questionnaire end-to-end; confirm the Netlify dashboard shows the submission and the email notification fires.
2. In the pipeline tool, mark a test business `not_fit`; reload the page; confirm it's hidden from default results; toggle "Show excluded"; confirm it reappears with a working restore action.
3. Mark a test business's status, hard-refresh, and reload from a different browser/session to confirm the change is really persisted server-side (not just remembered by that one browser).
4. Confirm the notes field saves and reloads correctly alongside status.

## Open items carried to later phases

- Sub-project #3: a repeatable (possibly semi-automated) process for turning questionnaire answers into a draft sample homepage
- Sub-project #4: domain registration + full-site build workflow, with the domain in the client's name
- Sub-project #5: subscription/upkeep billing for converted clients
- Automatic linkage between a Netlify form submission and its tracker row
- Custom domain for Harbor Sites itself, once one is chosen/purchased
