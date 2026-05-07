---
applyTo: "**/*"
---

# GitHub Copilot Instructions

## Project Philosophy

Cratis builds tools for event-sourced systems with a focus on **ease of use**, **productivity**, and **maintainability**. Every rule in these instructions serves one or more of these core values:

- **Lovable APIs** — APIs should be pleasant to use. Provide sane defaults, make them flexible, extensible, and overridable. If an API feels awkward, it is wrong.
- **Easy to do things right, hard to do things wrong** — Convention over configuration. Artifact discovery by naming. Minimal boilerplate. The framework should guide developers into the pit of success.
- **Events are facts** — Immutable records of things that happened. Never nullable, never ambiguous, never multipurpose. If you find yourself adding a nullable property to an event, you need a second event.
- **Full-stack type safety** — Shared models flow from TypeScript. End-to-end typing without manual synchronization.
- **Specialization over reuse** — Build focused, purpose-specific projections and read models rather than reusing one model across conflicting scenarios. Dedicated models are easier to maintain, perform better, and never break unrelated features.
- **Consistency is king** — When in doubt, follow the established pattern. Consistency across the codebase trumps local optimization. A slightly less elegant solution that matches the rest of the codebase is better than a clever one that stands out.

When these instructions don't explicitly cover a situation, apply these values to make a judgment call.

## General

- **Always use American English spelling** in all code, comments, and documentation — no exceptions.
  - `-ize` not `-ise`: initialize, serialize, customize, normalize, organize, authorize, specialize, centralize, utilize
  - `-or` not `-our`: behavior, color, favor, honor, humor, neighbor, flavor
  - `-ization` not `-isation`: initialization, serialization, customization, normalization, organization, authorization
  - `-er` not `-re`: center, fiber, meter
  - `-og` not `-ogue`: dialog, catalog, analog
  - `-ling` not `-lling`: modeling, signaling, labeling, canceling
  - `-ense` not `-ence`: license, defense, offense
  - `-ment` not `-ement`: judgment, acknowledgment
  - Other: gray (not grey), program (not programme), fulfill (not fulfil), enroll (not enrol)
  - When in doubt, use the US spelling — check a US dictionary.
- Write clear and concise comments for each function.
- Make only high confidence suggestions when reviewing code changes.
- Never change package.json or package-lock.json files unless explicitly asked to.
- Always ensure that the code compiles without warnings.
- Always treat warnings as errors and fix them before considering the work complete.
- Always ensure that the code passes all tests.
- Always ensure that the code adheres to the project's coding standards.
- Always ensure that the code is maintainable.
- For PR descriptions, use short release-note bullets that focus on **user-facing impact only** — new APIs, changed behavior, fixed bugs. Do not include internal implementation details (storage changes, converter updates, gRPC internals, spec additions). Append the **actual** issue number only when the PR is associated with a real GitHub issue (for example `(#351)`). If there is no associated issue, omit the reference entirely. Never use placeholder text like `(#issue)`, never leave the literal example `(#123)`, and never invent a random issue number. Never include Copilot "Original prompt" blocks. **Always verify the issue number using the `search_issues` or `list_issues` GitHub MCP tool — never guess or invent a number.**
- Always reuse the active terminal for commands.
- Do not create new terminals unless current one is busy or fails.
- When asked to commit, push, create a PR, ship, or land changes, always use the **ship-changes** skill.

## Development Workflow

- After creating each new file, run `yarn compile` (TypeScript) immediately before proceeding to the next file. Fix all errors as they appear — never accumulate technical debt.
- Before adding parameters to interfaces or function signatures, review all usages to ensure the new parameter is needed at every call site.
- When modifying imports, audit all occurrences — verify additions are used and removals don't break other files.
- Before concluding any task, run the relevant specs/tests for every affected project and do not stop until they pass.
- **After pushing changes to a PR**, use the GitHub MCP tools (`pull_request_read` with `get_check_runs`, `get_job_logs`) to monitor CI check results. If any checks fail, investigate the logs, fix the failures, and push again. The task is not complete until all CI checks pass or the remaining failures are confirmed to be pre-existing flaky tests unrelated to the PR changes.

## Header

All TypeScript files should start with the following header:

```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
```
