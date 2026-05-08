---
applyTo: "**/*"
---

# How to Write Git Commits

Commits are the permanent record of how the codebase evolved. Each commit should tell a clear story: *what* changed and *why*.

## Logical Grouping

Every commit must be a **single logical unit of work**. Group related changes together; separate unrelated changes into distinct commits.

## Commit Messages

### Format

```
<imperative summary of what this commit does>

<optional body — why the change was made, context, trade-offs>
```

- **Subject line**: imperative mood, present tense. Start with a verb: `Add`, `Fix`, `Remove`, `Rename`, `Extract`, `Update`, `Support`.
- **No period** at the end of the subject line.
- **72-character limit** on the subject line.
- **Body**: separated from the subject by a blank line. Explain *why*, not *what* (the diff shows the what).

### Good examples

```
Add TypeScript decorator for event type registration
```

```
Fix reactor handler not invoking async methods correctly
```

### Bad examples

- `Fix stuff` — meaningless.
- `WIP` — never commit work-in-progress.
- `Add files` — says nothing about what or why.

## When to Commit

- **After each logical unit passes the build** — `yarn compile` with zero errors and zero warnings.
- **Before starting a different kind of work** — about to switch from fixing a bug to adding a feature? Commit the bug fix first.
- **Never commit code that does not compile.**
