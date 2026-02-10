# Requirements: Lightdash MCP Server

**Defined:** 2026-02-10
**Core Value:** Clean, filtered Lightdash data access through MCP -- every tool returns only the fields Claude needs, never raw API dumps.

## v1.2 Requirements

Requirements for npm distribution milestone. Each maps to roadmap phases.

### Package

- [ ] **PKG-01**: User can install via `npx -y lightdash-mcp` (npm package published as `lightdash-mcp`)
- [ ] **PKG-02**: package.json has bin, files, engines, keywords, repository, license fields (no "private" field)
- [ ] **PKG-03**: build/index.js starts with `#!/usr/bin/env node` shebang
- [ ] **PKG-04**: `npm publish --access public` succeeds and package is live on npmjs.com

### Documentation

- [ ] **DOC-01**: README rewritten for non-engineers: npx-first setup (paste JSON config, replace placeholders, restart)
- [ ] **DOC-02**: README includes optional User Preferences section (CSV tables + Recharts charts)
- [ ] **DOC-03**: README includes tools reference table
- [ ] **DOC-04**: README includes troubleshooting (3 common issues)
- [ ] **DOC-05**: README includes manual install alternative (git clone fallback)
- [ ] **DOC-06**: README is under 200 lines

### Verification

- [ ] **VER-01**: `npx -y lightdash-mcp` starts the server (verified with dummy env vars)
- [ ] **VER-02**: Git commit and push after publish

## Future Requirements

None planned.

## Out of Scope

| Feature | Reason |
|---------|--------|
| TypeScript source in npm package | Only compiled JS in build/ ships |
| CI/CD pipeline | Manual publish for now |
| Docker image | Unnecessary for MCP stdio server |
| Test suite | No logic changes in this milestone |
| Scoped package name (@timeleft-dev/) | `lightdash-mcp` is available |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PKG-01 | — | Pending |
| PKG-02 | — | Pending |
| PKG-03 | — | Pending |
| PKG-04 | — | Pending |
| DOC-01 | — | Pending |
| DOC-02 | — | Pending |
| DOC-03 | — | Pending |
| DOC-04 | — | Pending |
| DOC-05 | — | Pending |
| DOC-06 | — | Pending |
| VER-01 | — | Pending |
| VER-02 | — | Pending |

**Coverage:**
- v1.2 requirements: 12 total
- Mapped to phases: 0
- Unmapped: 12

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*
