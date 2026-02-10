# Requirements: Lightdash MCP Server

**Defined:** 2026-02-10
**Core Value:** Clean, filtered Lightdash data access through MCP -- every tool returns only the fields Claude needs, never raw API dumps.

## v1.1 Requirements

Requirements for v1.1 Distribution & Docs release. Each maps to roadmap phases.

### GitHub Setup

- [ ] **GH-01**: Repository `lightdash-mcp` created on GitHub with proper .gitignore (node_modules, build, .env)
- [ ] **GH-02**: package.json updated with repository URL, description, license, and keywords

### Documentation

- [ ] **DOCS-01**: README covers what the server does and lists all 10 tools
- [ ] **DOCS-02**: README has step-by-step prerequisites (Node.js install, git clone, npm install)
- [ ] **DOCS-03**: README has step-by-step Lightdash PAT creation guide
- [ ] **DOCS-04**: README has Claude Desktop configuration with copy-paste JSON
- [ ] **DOCS-05**: README has troubleshooting section (common errors and fixes)
- [ ] **DOCS-06**: README has optional section for Claude Desktop preferences (CSV tables, chart artifacts)

## Future Requirements

- **DIST-01**: Publish to npm for `npx` installation
- **DIST-02**: Docker image for containerized deployment
- **CI-01**: GitHub Actions CI pipeline (lint, type-check)

## Out of Scope

| Feature | Reason |
|---------|--------|
| npm publishing | Keep it simple -- git clone for now |
| Docker support | Overkill for Claude Desktop stdio use case |
| CI/CD pipeline | Not needed for documentation milestone |
| Automated tests | Deferred to future milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GH-01 | Phase 4 | Pending |
| GH-02 | Phase 4 | Pending |
| DOCS-01 | Phase 4 | Pending |
| DOCS-02 | Phase 4 | Pending |
| DOCS-03 | Phase 4 | Pending |
| DOCS-04 | Phase 4 | Pending |
| DOCS-05 | Phase 4 | Pending |
| DOCS-06 | Phase 4 | Pending |

**Coverage:**
- v1.1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after v1.1 roadmap creation*
