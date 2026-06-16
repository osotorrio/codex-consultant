# Codex Consultant

Codex Consultant helps you get more out of Codex in a real project.

Run it in any local repo and it will inspect your Codex setup, ask a few useful
questions, and give you a practical report with recommendations. It is designed
to help you tighten your setup, reduce repetitive prompting, and move toward a
more agentic delivery workflow.

It does this without editing the project it audits.

## Why Use It

- Find stale or missing Codex guidance, such as weak `AGENTS.md` instructions.
- Spot permission, sandbox, MCP, plugin, and workflow opportunities.
- Turn repeated prompt/response habits into reusable agent workflows.
- Keep a memory of prior reports and recommendation status across runs.
- Get a readable action plan instead of a pile of raw repo facts.

Think of it as a quick Codex setup checkup for your project.

## Quick Start

These steps are for authorized testers. You need Codex CLI and Node.js
available on your machine.

1. Add this repository as a Codex plugin marketplace:

   ```bash
   codex plugin marketplace add osotorrio/codex-consultant
   ```

2. Open Codex in the project you want to review:

   ```bash
   cd path/to/your-project
   codex
   ```

3. Open the plugin browser:

   ```text
   /plugins
   ```

4. Install **Codex Consultant**, then restart Codex in the project.

5. Switch the session to read-only mode:

   ```text
   /permissions
   ```

   Select **Read Only**.

6. Run the consultant:

   ```text
   $codex-consultant Run a read-only Codex consultant audit for this project.
   ```

The consultant will inspect the project, ask a short delta interview, and return
a structured report you can act on.

## What You Get

Each run produces a report with:

- a snapshot of the project and Codex setup
- the most important recommendations first
- evidence for each finding
- suggested next actions
- status tracking for prior recommendations

Reports and cross-run state are saved outside the audited project under:

```text
$CODEX_HOME/codex-consultant/
```

If `CODEX_HOME` is unset, Codex uses its default home directory.

## Safety Model

The audited project stays read-only. Codex Consultant should not create,
modify, move, or delete project files.

It skips likely secret-bearing files by default and stores only summarized
history from local Codex sessions or memories. Report files and state belong to
the consultant, not to the project being reviewed.

## For Maintainers

Important files:

- `.agents/plugins/marketplace.json` exposes this repo as a plugin marketplace.
- `plugins/codex-consultant/.codex-plugin/plugin.json` defines the plugin.
- `plugins/codex-consultant/skills/codex-consultant/SKILL.md` defines the
  consultant workflow.
- `plugins/codex-consultant/scripts/` contains the read-only inventory and
  report-saving helpers.

Run the local checks with:

```bash
npm test
```

## License

This project is proprietary and all rights are reserved. Use is limited to
authorized testers unless a separate written license says otherwise. See
`LICENSE`.
