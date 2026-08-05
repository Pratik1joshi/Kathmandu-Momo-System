# Kathmandu Momo System Documentation

This directory is the working documentation set for product, engineering, operations, deployment, security, and QA. It reflects the repository as audited on **2026-08-05** (Next.js 16, 68 application pages, 104 API route files, and 44 PostgreSQL tables in the current schema dump).

## Start here

| Document | Audience | Purpose |
|---|---|---|
| [PRD.md](PRD.md) | Owner, product, QA | Product scope, users, requirements, and success criteria |
| [APP_FLOW.md](APP_FLOW.md) | QA, product, operations | End-to-end user and system journeys |
| [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) | QA, engineering, finance | Status rules, calculations, stock, and accounting behavior |
| [TRD.md](TRD.md) | Engineering, DevOps, QA | Architecture and technical requirements |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Engineering, integration QA | API groups, authentication, methods, and contracts |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Engineering, DBA, QA | Data model and integrity expectations |
| [SECURITY.md](SECURITY.md) | Engineering, security QA | Security model and verification controls |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | DevOps, release manager | Fresh install, upgrade, backup, rollback, and verification |
| [QA_CHECKLIST.md](QA_CHECKLIST.md) | QA and release manager | Full production-readiness test plan and sign-off |
| [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) | Owner and release team | Go-live decision checklist |
| [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) | Owner and product | Prioritized post-launch improvements |
| [AI_HANDOFF_CONTEXT.md](AI_HANDOFF_CONTEXT.md) | Next AI, engineering, QA | Current implementation state, evidence, blockers, and next action |
| [WEBSITE_WHATSAPP_ORDERING.md](WEBSITE_WHATSAPP_ORDERING.md) | Operations, QA, engineering | Online request lifecycle, routes, safeguards, migration, and limits |

## Existing audit material

The repository also contains historical audit/runbook files: `PRODUCTION_AUDIT.md`, `FINAL_PRODUCTION_AUDIT.md`, `PRODUCTION_VERIFICATION.md`, and `CPANEL_DEPLOYMENT.md`. Use the documents above as the maintained functional baseline; use audit files as supporting evidence, not as a substitute for executing the QA checklist.

## Document rules

- Update these files in the same pull request as a behavior, API, schema, environment, or release-process change.
- Never place real credentials, customer data, session tokens, or production database dumps in documentation.
- QA records actual result, evidence, environment, build identifier, and defect ID for every failed or blocked case.
- A checked box means the item was executed against the named release candidate; it is not a permanent assertion.
