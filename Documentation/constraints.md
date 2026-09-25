<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Constraints in the TypeScript client

Use `@unique` on an event property to prevent the same value from being claimed by another event source. The client groups properties with the same constraint name into one definition, including properties on different event types. Without a name, the property name is used.

The following example shares `UniqueEmail` between registration and address changes. Either event that ends the lifecycle can release it:

[Unique property and release events](./client-snippets/constraints/unique-property.md)

Use `@unique` on an event class instead to allow only one occurrence of that event type per event source. The default constraint name is the class name; event classes with the same explicit name participate in the same unique-event-type constraint.

[Unique event type and release events](./client-snippets/constraints/unique-event-type.md)

Place repeatable `@removeConstraint('Name')` decorators on any event class that releases the named constraint. The name must match exactly; a single event can release several names. Event classes need `@eventType` and must be discoverable by the client (including through its artifact glob). Constraints are registered on connection, and the Kernel enforces them on append. The core client does not require MongoDB or a local uniqueness check.

`@unique(name?, message?)` accepts the same fixed name and message arguments as .NET's `[Unique]`. For example, `@unique('UniqueEmail', 'Email already registered')`. A supplied message replaces the Kernel's default in append results; `{detailKey}` placeholders are replaced from violation details. Without a message, the Kernel's message remains visible. The .NET attribute does not offer ignore-casing: use the fluent `@constraint` / `IConstraintBuilder.unique(...).ignoreCasing()` form when case-insensitive matching is needed. The fluent form remains supported; the decorators feed the same registration path.

For the underlying consistency model and more examples, see [Chronicle constraints](/chronicle/constraints/).
