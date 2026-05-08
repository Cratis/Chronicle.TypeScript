---
applyTo: "**/*"
---

# Code Quality

Good code is not just code that works — it is code that can be understood, changed, and extended safely. The principles below are the foundation for writing code that remains maintainable as the system grows. They are not abstract ideals; each one has a concrete, practical consequence for how you write and structure code in this project.

## Composition over Inheritance

Prefer composing behavior from smaller, focused collaborators over building class hierarchies. Inheritance couples the child tightly to the parent's internal structure — a change to the parent can break every subclass. Composition keeps collaborators independent and replaceable.

**Rules:**
- Never extend a concrete class to add or change behavior — inject a collaborator instead.
- Inheritance is acceptable only for framework integration points where a base class is part of a well-defined extension mechanism.

## Single Responsibility Principle

Every type and every method should have **one reason to change** — it should do one thing and do it well.

**Rules:**
- A class or method that requires a comment explaining what each section does is a sign it should be split.
- Methods longer than ~20 lines are a signal they are doing too much — extract collaborators or helper methods.

## Open/Closed Principle

Types should be **open for extension, closed for modification**.

**Rules:**
- Prefer strategy interfaces over `switch`/`if-else` chains that grow over time.
- Design public APIs as contracts (interfaces/records) rather than concrete implementations.

## Separation of Concerns

Each layer and each module should own exactly one concern.

**Rules:**
- Keep domain logic out of infrastructure — domain types must not reference infrastructure or transport concepts directly.
- Keep infrastructure out of domain logic — handlers and domain types express intent; they delegate to collaborators for persistence, messaging, and I/O.

## Low Coupling

Coupling is the degree to which one module depends on the internals of another. High coupling means a change in one place forces changes everywhere else.

**Rules:**
- Depend on abstractions, not on concrete implementations.
- Avoid reaching through an object to call methods on its dependencies.
- Limit the number of dependencies a single type takes — more than four or five is a signal it is doing too much.

## High Cohesion

Cohesion measures how closely related the responsibilities within a module are.

**Rules:**
- Group code by feature, not by technical role — everything for a behavior belongs together.
- Utilities and helpers are acceptable only when the operations they provide are genuinely shared across features.

## File Size — 200-Line Guideline

A file exceeding **200 lines** is a strong signal that it contains too many responsibilities.

**Rules:**
- When a file crosses 200 lines, look for natural split points: a sub-concept that could become its own type, a behavior that could move to a collaborator, or a section that belongs in a different layer.
- Aim for files that can be understood in a single reading without scrolling.
