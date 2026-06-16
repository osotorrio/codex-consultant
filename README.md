# codex-consultant

A Codex plugin that runs a read-only consultant audit of how a project uses
Codex and produces a structured recommendations report.

The target project stays read-only. The consultant may write only to its own
state root outside the audited project:

```text
$CODEX_HOME/codex-consultant/
```

If `CODEX_HOME` is not set, Codex's default home is used.

## What It Audits

- Codex instruction files such as `AGENTS.md` and `AGENTS.override.md`
- Project Codex settings under `.codex/`
- Repo skills/plugins under `.agents/`
- Package scripts, CI workflows, Makefiles, Docker/devcontainer files, and docs
- Git state and commits since the previous consultant run
- Local Codex state summaries: config, sessions, memories, plugins, and user skills

It skips likely secret-bearing files by default and stores only summarized
history from local Codex sessions or memories.

## Repository Layout

- `.agents/plugins/marketplace.json` exposes the local plugin marketplace.
- `plugins/codex-consultant/.codex-plugin/plugin.json` is the plugin manifest.
- `plugins/codex-consultant/skills/codex-consultant/SKILL.md` defines the
  consultant workflow.
- `plugins/codex-consultant/scripts/consultant-audit.mjs` gathers read-only
  inventory and can save run state outside the target project.
- `plugins/codex-consultant/scripts/save-report.mjs` saves a Markdown report
  outside the target project.

## Local Validation

```bash
npm test
```

## Manual Helper Usage

Generate inventory without writing state:

```bash
node plugins/codex-consultant/scripts/consultant-audit.mjs inventory --project .
```

Generate inventory and save run state outside the project:

```bash
node plugins/codex-consultant/scripts/consultant-audit.mjs inventory --project . --save
```

Save a report outside the project:

```bash
node plugins/codex-consultant/scripts/save-report.mjs --project . --title "Codex Consultant Report" < report.md
```
