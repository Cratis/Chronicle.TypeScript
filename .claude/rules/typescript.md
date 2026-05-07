---
applyTo: "**/*.ts,**/*.tsx"
paths:
  - "**/*.ts"
  - "**/*.tsx"
---


# TypeScript Conventions

TypeScript's type system is the primary tool for catching bugs before they reach production. Every rule here pushes toward maximum compiler coverage and self-documenting code. If the types are right, the code almost writes itself.

## Enums over Magic Strings

String literal unions look concise but provide no refactoring support, no namespace, and no discoverability. Enums give you all three — plus `switch` exhaustiveness checking.

```ts
// ✅ Correct — refactorable, discoverable, exhaustive
export enum EventObservationState {
    None = 'none',
    Initial = 'initial',
    Replay = 'replay',
}

// ❌ Wrong — no refactoring support, invisible to tooling
export type EventObservationState = 'none' | 'initial' | 'replay';
```

- Use enum members everywhere — `switch` cases, comparisons, defaults.
- Do **not** import enums as `type`; they are values.
- Export enums from `index.ts` without the `type` keyword.

## One Type or Enum per File

Each type gets its own file because it makes the codebase navigable — finding a type means opening the file named after it. It also keeps diffs clean and makes imports explicit.

- Every interface, type alias, and enum lives in **its own file**, named after the type (e.g. `EventType.ts`).
- **Never create** `types.ts`, `models.ts`, `interfaces.ts` grab-bag files — they become dumping grounds that grow without limit.
- Aggregate exports through the folder's `index.ts`.

## Type Safety

`any` disables the compiler — the one tool that catches bugs for free. Every `any` is a hole in the safety net. Use `unknown` and narrow with type guards instead.

- Never use `any` — use `unknown`, `Record<string, unknown>`, or proper generic constraints.
- Prefer `value as unknown as TargetType` over `value as any`.
- Use `unknown` as default generic parameter instead of `any`.

## Language — American English Only

All identifiers, comments, JSDoc, and string literals must use **American English** spelling. This applies to variable names, function names, type names, enum members, and documentation.

## Variables and Naming

- Prefer `const` over `let` over `var` when declaring variables.
- Never use shortened or abbreviated names for variables, parameters, or properties.
  - Use full descriptive names: `deltaX` not `dx`, `index` not `idx`, `event` not `e`, `previous` not `prev`.
  - The only acceptable short names are well-established domain terms (e.g. `id`, `url`, `min`, `max`).

## Imports and Compilation

- Never leave unused import statements in the code.
- Always ensure that the code compiles without warnings — use `yarn compile` to verify (successful runs produce no output).
- Review each file for lint compliance before finalizing.
- Never use placeholder or temporary types — use proper types from the start.

## Folder Structure

- Do not prefix a file, component, type, or symbol with the name of its containing folder or the concept it belongs to. Instead, use folder structure to provide that context.
- Favor functional folder structure over technical folder structure.
  - Group files by the feature or concept they belong to, not by their technical role.
  - Avoid folders like `utils/`, `types/` at the feature level.

## Decorators

TypeScript decorators are the idiomatic replacement for C# attributes in this codebase.

- Use decorators to adorn classes and methods with metadata (e.g. `@eventType`, `@reactor`, `@reducer`).
- Decorator factories (functions that return a decorator) are preferred for decorators that accept parameters.
- Keep decorator logic minimal — decorators should store metadata, not execute complex logic.
- Use `Reflect.metadata` or a metadata registry to store and retrieve decorator metadata.
