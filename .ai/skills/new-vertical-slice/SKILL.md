---
name: new-vertical-slice
description: >
  Implement an application vertical slice with focused backend, behavior-spec,
  and applicable frontend checks.
---

Use this recipe only for the application profile. Read [the owning project rules](../../rules/general.md) first; framework/library contributions use their framework guidance instead. Keep one writer/build per checkout, follow backend dependencies before frontend work, and apply only steps relevant to the changed behavior.

## Step 1 — Identify the slice type

Choose **one** of:
- **State Change** — a command that mutates state and records events (most common)
- **State View** — a query that reads from a read model
- **Automation** — a background reactor triggered by events
- **Translation** — transforms events into other events

## Step 2 — Determine the namespace root

Inspect the affected project and existing `.cs` files under its actual application source root to determine the namespace and layout. Do not invent a top-level `Features/` wrapper or hard-code the namespace.

## Step 3 — Create the C# slice file

Follow the local slice convention, normally `<AppSourceRoot>/<Feature>/<Slice>/<Slice>.cs`, with an optional module above the feature. Keep the behavior together; split only when the owning rules justify it.

File creation order within the slice:
1. Concept types (if new strongly-typed IDs are needed — see `add-concept` skill)
2. Command `record` with `Handle()` method and optional validation attributes
   - If a business rule depends on Chronicle event-sourced state, add the relevant read model as a parameter to `Handle()` — see `add-business-rule` skill (DCB pattern)
3. Constraint class `<Name>Constraint` (if needed)
5. Event `record` with `[EventType]` (no arguments, no mutable properties)
6. Read model `record` with `[ReadModel]` and model-bound projection attributes (`[FromEvent<T>]`, `[Key]`, etc.)
   - Use fluent `IProjectionFor<T>` only when model-bound attributes don't fit

**Critical rules:**
- Commands are `record` types with a `Handle()` method directly on them — DO NOT create separate handler classes
- Events use `[EventType]` with NO arguments — never pass a GUID or string
- Projection: prefer model-bound attributes on the read model; if using `IProjectionFor<T>`, AutoMap is on by default — just call `.From<>()` directly
- Namespace must be `<NamespaceRoot>.<Feature>.<Slice>` (drop `.Features.` segment)
- Copyright header on every file: `// Copyright (c) Cratis. All rights reserved. // Licensed under the MIT license. See LICENSE file in the project root for full license information.`

## Step 4 — Build

Run the owning project's affected Debug build to regenerate required TypeScript proxies. Fix in-scope errors and warnings; report unrelated or unavailable gates as blockers rather than repeatedly rebuilding the whole repository.

## Step 5 — Write applicable behavior specs

Cover the changed behavior for every slice type: commands and rejection paths, State View projection/reducer behavior, and Automation/Translation reactions as applicable. For each changed command, cover:
- Happy path — command succeeds, correct event appended
- Each validation failure (one spec per rule)
- Each business rule violation (one spec per DCB condition in `Handle()` that inspects a read model)
- Each constraint violation

See `write-specs` skill for the complete spec structure.

Run the affected project's relevant specs. Rerun after an in-scope fix; stop and report an unavailable or unrelated failure instead of changing unrelated code to obtain a green result.

## Step 6 — Implement React component(s)

Place applicable `.tsx` files beside the owning slice under `<AppSourceRoot>/<Feature>/<Slice>/` (with an optional module above the feature).

- Import the auto-generated command/query proxy from the same folder
- Use `CommandDialog` from `@cratis/components/CommandDialog` for command dialogs
- Use `Dialog` from `@cratis/components/Dialogs` for data-only dialogs — NEVER import from `primereact/dialog`
- Use PrimeReact CSS variables for all colours — never hard-code hex values
- Use full descriptive variable names — never abbreviations (`event` not `e`, `index` not `idx`)
- No `any` types — use `unknown` with type guards

**Command usage:**
```tsx
const [myCommand] = MyCommand.use();
const handleSubmit = async () => {
    myCommand.propertyName = value;
    const result = await myCommand.execute();
    if (result.isSuccess) closeDialog(DialogResult.Ok);
};
```

**Query with paging:**
```tsx
const pageSize = 10;
const [result, , setPage] = MyQuery.useWithPaging(pageSize);
// Use result.data, result.paging.totalItems, result.paging.page
```

## Step 7 — Update the composition page

Update the actual feature composition page under the application's source root. If a new page is introduced, also update the router and navigation; do not create an otherwise unused `Features/` hierarchy.

## Step 8 — Quality gates

Use the authoritative checks for the affected lanes; the commands below are examples, not an unconditional repository-wide matrix. Require relevant checks to pass and disclose any blocked or unrun checks:
- `dotnet build` — zero errors/warnings
- `dotnet test` — zero failures
- `yarn lint` — zero errors
- `npx tsc -b` — zero errors
- Public-facing changes (clients, SDKs, public APIs) include associated documentation updates
- `Documentation/verify-markdown.sh` passes when documentation is added or changed

---

For complete code patterns for all 4 slice types and frontend examples, see [references/PATTERNS.md](references/PATTERNS.md).
