<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Constraints in the TypeScript client

Use `@unique` on an event property to prevent the same value from being claimed by another event source. The client groups properties with the same constraint name into one definition, including properties on different event types. Without a name, the property name is used.

The following example shares `UniqueEmail` between user registration and email changes. Either event that ends the lifecycle can release it:

```typescript
import { eventType, unique, removeConstraint } from '@cratis/chronicle';

@eventType('sdk-user-registered')
class SdkUserRegistered {
    @unique('UniqueEmail') email = '';
}

@eventType('sdk-user-email-changed')
class SdkUserEmailChanged {
    @unique('UniqueEmail') newEmail = '';
}

@eventType('sdk-user-deleted')
@removeConstraint('UniqueEmail')
class SdkUserDeleted {}

@eventType('sdk-user-anonymized')
@removeConstraint('UniqueEmail')
class SdkUserAnonymized {}
```

Use `@unique` on an event class instead to allow only one occurrence of that event type per event source. The default constraint name is the class name; event classes with the same explicit name participate in the same unique-event-type constraint.

```typescript
@eventType('sdk-account-registered')
@unique('UniqueAccount')
class SdkAccountRegistered {}

@eventType('sdk-account-closed')
@removeConstraint('UniqueAccount')
class SdkAccountClosed {}

@eventType('sdk-account-reopened')
@removeConstraint('UniqueAccount')
class SdkAccountReopened {}
```

Place repeatable `@removeConstraint('Name')` decorators on any event class that releases the named constraint. The name must match exactly; a single event can release several names. Removal decorators are inherited by derived event classes and can also release a fluent constraint with the same wire name. Event classes need `@eventType` and must be discoverable by the client (including through its artifact glob). Constraints are registered on connection, and the Kernel enforces them on append. The core client does not require MongoDB or a local uniqueness check.

`@unique(name?, message?)` accepts the same fixed name and message arguments as .NET's `[Unique]`. For example, `@unique('UniqueEmail', 'Email already registered')`. A supplied message replaces the Kernel's default in append results; `{detailKey}` placeholders are replaced from violation details. Without a message, the Kernel's message remains visible. The .NET attribute does not offer ignore-casing: use the fluent `@constraint` / `IConstraintBuilder.unique(...).ignoreCasing()` form when case-insensitive matching is needed. The fluent form remains supported; the decorators feed the same registration path. For shared stores across languages and minified bundles, always give constraints explicit, stable names rather than relying on property or class names. TypeScript deliberately merges same-named unique-event-type declarations across fluent `uniqueFor` constraints and class-level `@unique` decorators into one definition. This differs from .NET: its fluent `Unique<T>(name: ...)` merges within one `IConstraint`, not across constraint classes, while its attribute provider produces separate definitions for same-named class attributes. Merged declarations must agree on scope; decorated properties cannot merge with a case-insensitive fluent constraint. The first supplied message wins when declarations share a name. Fluent `withMessage` messages also resolve in append results.

For fluent `unique(...)` property constraints, the registered name is the `@constraint('Name')` id, even if `withName('OtherName')` is called. Use the `@constraint` id in `@removeConstraint('Name')`; `withName()` does not change the registered name.

For the underlying consistency model and more examples, see [Chronicle constraints](/chronicle/constraints/).
