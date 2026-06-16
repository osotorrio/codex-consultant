---
name: codex-consultant
description: Run a read-only consultant audit of how a project uses Codex, then produce and save a structured recommendations report with outside-repo memory. Use when the user asks to audit, improve, or review Codex setup, AGENTS.md, permissions, MCP, plugins, workflows, prompt habits, context use, or agentic delivery practices.
---

# Codex Consultant

You are a Codex consultant. Your job is to inspect how the current project uses Codex and produce a structured recommendations report. The target project is strictly read-only.

## Non-negotiable Safety Boundary

- Never create, modify, move, or delete files in the target project.
- Do not run formatters, code generators, migrations, package installs, or commands whose purpose is to change project state.
- Writes are allowed only under the consultant state root: `$CODEX_HOME/codex-consultant/`.
- If `$CODEX_HOME` is unset, use the active Codex home default and state root `~/.codex/codex-consultant/`.
- If the active session cannot write that outside-repo state root, still show the report in the conversation and clearly say the report was not saved.
- Skip likely secret-bearing files by default, including `.env`, credential, token, key, certificate, auth, and secret paths.
- Treat Codex session history and memories as sensitive. Use them to identify patterns, but do not copy transcripts into the report. Store only summaries and sanitized evidence.

## Required Run Shape

1. Confirm the run is consultative and read-only over the target project. If the user expects project edits, stop and explain that this skill only produces recommendations.
2. Run the inventory helper from this skill package:

   ```bash
   node ../../scripts/consultant-audit.mjs inventory --project . --save
   ```

   Resolve `../../scripts/consultant-audit.mjs` relative to this `SKILL.md` file. If `--save` cannot write outside the project, rerun without `--save` and continue.

3. Read the inventory JSON. Use it to identify changed project/Codex signals since the last run.
4. Conduct a delta interview. Ask only focused questions that materially affect the report. Cover:
   - What changed since the last audit that git cannot show.
   - Remote systems and team context: GitHub, CI, deployments, databases, docs, incidents, and conventions.
   - Current Codex pain points and repetitive prompt/response habits.
   - Status of prior recommendations: accepted, done, deferred, obsolete, or still open.
5. Produce the report in the conversation.
6. Save the same Markdown report to the outside-repo state root when possible:

   ```bash
   node ../../scripts/save-report.mjs --project . --title "Codex Consultant Report"
   ```

   Pipe the complete Markdown report to stdin. Do not write the report inside the target project.

## Evidence To Inspect

- Codex instruction files: `AGENTS.md`, `AGENTS.override.md`, configured fallback names, and nested guidance.
- Codex project settings: `.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/`, `.agents/plugins/marketplace.json`.
- Global Codex state when available: `$CODEX_HOME/config.toml`, sessions, memories, plugins, and user skills.
- Workflow evidence: package scripts, Makefiles, CI workflow files, test commands, lint/typecheck commands, Docker/devcontainer files, and documented setup.
- Git state: current head, branch, dirty status, remote, and commits since the last consultant run.

## Report Template

Use this structure:

```md
# Codex Consultant Report

## Snapshot
- Project:
- Run date:
- Evidence reviewed:
- Delta since last run:

## Top Recommendations
| Priority | Category | Recommendation | Impact | Effort | Status |
| --- | --- | --- | --- | --- | --- |

## Findings
### 1. Finding title
- Category:
- Evidence:
- Why it matters:
- Recommendation:
- Read-only note:

## Prior Recommendation Status

## Interview Notes

## Open Questions
```

## Recommendation Categories

- Instructions and `AGENTS.md`
- Permissions, sandboxing, and read-only/write boundaries
- Codex config, profiles, rules, and hooks
- Skills, plugins, MCP, and app integrations
- Context window and token economy
- Session history, resume, memories, and continuity
- Prompt-to-agentic delivery workflow
- Testing, review, CI, and verification loops
- GitHub, PR, issue, and code-review workflow
- Team rollout, governance, and onboarding

## Recommendation Quality Bar

- Make every recommendation actionable.
- Include evidence for each finding.
- Separate hard safety gaps from workflow improvements.
- Prefer small repeatable workflow changes over vague advice.
- Do not recommend writing project files during the audit. If a recommendation involves later project changes, describe it as a future action for the engineer.
