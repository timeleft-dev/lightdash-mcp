# Milestones

## v1.0 MVP (Shipped: 2026-02-10)

**Phases completed:** 3 phases, 8 plans, 13 feat commits
**Lines of code:** 1,327 TypeScript
**Timeline:** 2026-02-10 (single day)

**Key accomplishments:**
- Stdio-pure MCP server with console.log override, auth, URL normalization, envelope unwrapping, and error sanitization
- 5 discovery tools with aggressive server-side field filtering (413KB chart payloads reduced to compact responses)
- 4 data access tools: chart config, chart results with row flattening, explore schema, ad-hoc queries with native Lightdash filter passthrough
- Deploy pipeline: deploy.sh builds and copies to ~/lightdash-mcp/ with Claude Desktop config
- 10 read-only MCP tools, all with lightdash_ prefix, readOnlyHint: true, and wrapToolHandler error handling

---


## v1.1 Distribution & Docs (Shipped: 2026-02-10)

**Phases completed:** 1 phase, 2 plans
**New files:** README.md (248 lines), LICENSE, .gitignore
**Timeline:** 2026-02-10 (single day)

**Key accomplishments:**
- Public GitHub repo at github.com/timeleft-dev/lightdash-mcp with .gitignore and full package.json metadata
- 248-line beginner-friendly README: 10-tool reference, step-by-step install, PAT creation guide, Claude Desktop config, 6 troubleshooting entries, optional CSV/chart preferences
- MIT license

---

