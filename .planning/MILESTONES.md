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

