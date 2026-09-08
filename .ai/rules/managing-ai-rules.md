---
applyTo: "**/*"
---

# Managing AI Rules and Instructions

`.ai/` is the **single source of truth** for all AI assistant configuration in this repository — rules, agents, prompts, skills, and hooks. Everything is written once in `.ai/` and surfaced to each AI tool through symlinks.

> **Never edit files under `.github/` or `.claude/` directly.** Both folders are composed entirely of symlinks. Any direct edit would be lost the next time the symlink target changes, and would diverge from the canonical source.

## Folder structure

```
.ai/                             ← canonical source of truth (edit here)
├── rules/                       ← instruction/rule markdown files
├── agents/                      ← agent definition files
├── prompts/                     ← reusable prompt templates
├── skills/                      ← multi-step skill workflows
├── hooks/                       ← agent lifecycle hooks
└── workflows/                   ← shared CI workflow files

.github/                         ← GitHub Copilot integration (symlinks only — do NOT edit)
├── copilot-instructions.md      ← symlink → ../.ai/rules/general.md
├── instructions/
│   └── <name>.instructions.md   ← symlinks → ../../.ai/rules/<name>.md
├── agents/
│   └── <name>.agent.md          ← per-file symlink → ../../.ai/agents/<name>.md
├── prompts/                     ← symlink → ../.ai/prompts
├── skills/                      ← symlink → ../.ai/skills
└── hooks/                       ← symlink → ../.ai/hooks

.claude/                         ← Claude Code integration (symlinks only — do NOT edit)
├── CLAUDE.md                    ← symlink → ../.ai/rules/general.md
├── rules/
│   └── <name>.md                ← symlinks → ../../.ai/rules/<name>.md
├── agents/                      ← symlink → ../.ai/agents
├── prompts/                     ← symlink → ../.ai/prompts
├── skills/                      ← symlink → ../.ai/skills
└── hooks/                       ← symlink → ../.ai/hooks
```

Note: `prompts/`, `skills/`, `hooks/`, and Claude's `agents/` are **folder-level** symlinks. Copilot's `.github/agents/` is a real directory with individual `<name>.agent.md` symlinks to `../../.ai/agents/<name>.md`, because Copilot requires the `.agent.md` suffix. Rule adapters also use per-file symlinks to provide Copilot's `.instructions.md` suffix.

## Rule file format

Every rule file in `.ai/rules/` must start with a YAML frontmatter block containing at minimum an `applyTo` field (for GitHub Copilot). Add a `paths` field when the rule should also be scoped for Claude Code.

```markdown
---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
---

# Rule Title

Rule content here.
```

Use `applyTo: "**/*"` (and omit `paths`) for rules that apply to all files.

## Adding a new rule

1. **Create the canonical file** in `.ai/rules/<name>.md` with the appropriate frontmatter and content.

2. **Create the Copilot symlink** in `.github/instructions/`:

   ```bash
   cd .github/instructions
   ln -s ../../.ai/rules/<name>.md <name>.instructions.md
   ```

3. **Create the Claude symlink** in `.claude/rules/`:

   ```bash
   cd .claude/rules
   ln -s ../../.ai/rules/<name>.md <name>.md
   ```

4. If the rule applies to all files globally (like `general.md`), update the top-level symlinks:
   - `.github/copilot-instructions.md` → `../.ai/rules/general.md`
   - `.claude/CLAUDE.md` → `../.ai/rules/general.md`

## Updating an existing rule

Edit the canonical file in `.ai/rules/<name>.md`. **Do not touch anything in `.github/` or `.claude/`** — the symlinks automatically reflect the change.

## Updating agents, prompts, skills, or hooks

Add, edit, or remove canonical files inside the relevant `.ai/` subfolder (`agents/`, `prompts/`, `skills/`, `hooks/`). Folder-level adapters pick up canonical changes automatically. For a new or renamed agent, also create or update `.github/agents/<name>.agent.md` as a per-file symlink to `../../.ai/agents/<name>.md`; remove its adapter when removing the canonical agent. Claude's `.claude/agents` remains a folder symlink. **Edit canonical content, never author copies inside the adapter folders.**

## Renaming a rule

1. Rename the file in `.ai/rules/`.
2. Remove the old symlinks and recreate them pointing to the new filename:

   ```bash
   # In .github/instructions/
   rm <old-name>.instructions.md
   ln -s ../../.ai/rules/<new-name>.md <new-name>.instructions.md

   # In .claude/rules/
   rm <old-name>.md
   ln -s ../../.ai/rules/<new-name>.md <new-name>.md
   ```

3. Update any cross-references within other rule files that link to the renamed file by path.

## Symlink path conventions

Symlink targets use **relative paths** from the symlink's location to the canonical file:

| Symlink location | Target prefix |
|---|---|
| `.github/instructions/` | `../../.ai/rules/` |
| `.github/agents/<name>.agent.md` | `../../.ai/agents/<name>.md` |
| `.claude/rules/` | `../../.ai/rules/` |
| `.github/copilot-instructions.md` | `../.ai/rules/` |
| `.claude/CLAUDE.md` | `../.ai/rules/` |

## Distribution and local adapters

Cross-repository broadcast, all-to-all propagation, and reverse synchronization
are retired. Do not run legacy propagation or turn a consuming repository into a
hub. Shared public-safe behavior is authored and reviewed in `Cratis/AI`, generated
into `Cratis/AI.Distribution`, and consumed only at an immutable reviewed version
after release gates pass. Propose sanitized reusable improvements upstream for
review; never reverse-sync private trees or local facts.

These legacy repository-local rules remain locally maintained during canary;
this is not permission to patch generated immutable distribution bytes or copy
whole AI trees. Preserve private/project overlays, local skills, and minimal
host bootstraps. Keep legacy adapters and actual workflows in place until an
approved replacement passes canary and reviewed retirement gates. Update shared
packages via approved exact-version pins; roll back by version.

## Shared workflows

Existing `.ai/workflows/` files are legacy local compatibility assets, not a broadcast source. Do not invoke propagation or remove actual workflows in a rule edit. Shared workflow updates require reviewed immutable references and consuming-repository review.
