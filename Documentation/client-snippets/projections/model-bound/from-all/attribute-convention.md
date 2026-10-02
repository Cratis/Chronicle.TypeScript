<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

`@fromAllEvents(property?, contextProperty?)` subscribes the root projection to
every event type, like fluent `fromAll()` and .NET `[FromAll]`. Omit both arguments
to map the property with the same name on the event, or supply a source property
name. The optional second argument selects an event context property instead.
Both legacy and standard TypeScript decorators are supported.

Its mappings also apply to child projections through the root's `All` definition
with `IncludeChildren`; they can update or clear child properties as events are
processed. Decorating only a child model does not widen the root subscription.
If `@fromAllEvents` and `@fromEvery` (or `@fromAll`) target the same property,
`@fromAllEvents` takes precedence regardless of decorator order.

## Opting into all-event subscriptions

Changing a mapping to `@fromAllEvents` changes the projection definition and may
trigger automatic replay. Upgrading alone does not change existing `@fromAll`
definitions. With all-event subscriptions, unrelated events can create a read
model per event source or clear mapped properties when their payload lacks a
value. Removal events can still delete a read model. These effects also matter
for child mappings.

Other evolution policies may require you to initiate replay; `@notRewindable`
projections only apply the new behavior to future events after you opt in.
Prefer `@fromEvery` when you want to map only events already subscribed to,
without applying these shared mappings to children.

`@fromAll` remains a supported, deprecated alias for restricted mappings; prefer
`@fromEvery`. Contrary to the earlier 'next major' announcement, its behavior will
not change; use `@fromAllEvents` to opt into all-event subscriptions.
`@fromEvery` still takes precedence over `@fromAll` on the same property.

```typescript title="Convention-based fromAllEvents property"
import { eventType, fromAllEvents, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ProductRenamedFromAllConvention {
    @field(String) readonly name: string;
    @field(Number) readonly version: number;

    constructor(name: string, version: number) {
        this.name = name;
        this.version = version;
    }
}

@eventType()
export class ProductPriceChangedFromAllConvention {
    @field(Number) readonly price: number;
    @field(Number) readonly version: number;

    constructor(price: number, version: number) {
        this.price = price;
        this.version = version;
    }
}

@fromEvent(ProductRenamedFromAllConvention)
@fromEvent(ProductPriceChangedFromAllConvention)
export class ProductVersionFromAllConvention {
    @field(String) name = '';
    @field(Number) price = 0;

    @fromAllEvents()
    version = 0;
}
```
