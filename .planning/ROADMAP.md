# Roadmap: Lightdash MCP Server

## Milestones

- [x] **v1.0 MVP** — Phases 1-3 (shipped 2026-02-10)
- [x] **v1.1 Distribution & Docs** — Phase 4 (shipped 2026-02-10)
- [ ] **v1.2 npm Distribution** — Phases 5-6 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) — SHIPPED 2026-02-10</summary>

- [x] Phase 1: Foundation & Stdio Infrastructure (3/3 plans) — completed 2026-02-10
- [x] Phase 2: Discovery Tools (2/2 plans) — completed 2026-02-10
- [x] Phase 3: Data Access & Deployment (3/3 plans) — completed 2026-02-10

</details>

<details>
<summary>v1.1 Distribution & Docs (Phase 4) — SHIPPED 2026-02-10</summary>

- [x] Phase 4: GitHub Publication & README (2/2 plans) — completed 2026-02-10

</details>

### v1.2 npm Distribution (In Progress)

**Milestone Goal:** Publish to npm so users install via `npx -y lightdash-mcp` instead of cloning.

- [ ] **Phase 5: npm Package & Publish** — Package metadata, shebang, publish to npm registry
- [ ] **Phase 6: README Rewrite & Verification** — Rewrite README for npx-first non-engineer audience, verify end-to-end

## Phase Details

### Phase 5: npm Package & Publish
**Goal**: Package is live on npm and installable via `npx -y lightdash-mcp`
**Depends on**: Phase 4 (repo exists on GitHub)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04
**Success Criteria** (what must be TRUE):
  1. `npm info lightdash-mcp` returns package metadata from the npm registry
  2. package.json contains bin, files, engines, keywords, repository, and license fields with no "private" field
  3. build/index.js starts with `#!/usr/bin/env node` shebang line
  4. `npx -y lightdash-mcp` downloads and starts the server process
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: README Rewrite & Verification
**Goal**: README speaks to non-engineers with npx-first install and the full workflow is verified end-to-end
**Depends on**: Phase 5 (package must be published so README can reference npx install and verification can run)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, VER-01, VER-02
**Success Criteria** (what must be TRUE):
  1. README leads with npx-based setup (paste JSON config, replace two placeholders, restart Claude Desktop)
  2. README contains tools reference table, troubleshooting section, manual install alternative, and user preferences section -- all under 200 lines total
  3. `npx -y lightdash-mcp` starts the MCP server successfully (verified with dummy env vars)
  4. All changes are committed and pushed to GitHub
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Stdio Infrastructure | v1.0 | 3/3 | Complete | 2026-02-10 |
| 2. Discovery Tools | v1.0 | 2/2 | Complete | 2026-02-10 |
| 3. Data Access & Deployment | v1.0 | 3/3 | Complete | 2026-02-10 |
| 4. GitHub Publication & README | v1.1 | 2/2 | Complete | 2026-02-10 |
| 5. npm Package & Publish | v1.2 | 0/? | Not started | - |
| 6. README Rewrite & Verification | v1.2 | 0/? | Not started | - |
