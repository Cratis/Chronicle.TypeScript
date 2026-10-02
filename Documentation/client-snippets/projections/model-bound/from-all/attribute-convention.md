<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

`@fromAll` subscribes the root projection to every event type, like fluent
`fromAll()` and .NET `[FromAll]`. Its mappings also apply to child projections.
If `@fromAll` and `@fromEvery` target the same property, `@fromAll` takes precedence.

## Breaking change

Replace `@fromAll` with `@fromEvery` before upgrading to keep the previous behavior:
mapping only events the projection already subscribes to, without applying these
mappings to children. Keep the decorator arguments unchanged and update the import.

Existing `@fromAll` projections get a different definition. With automatic replay
on definition changes, they will be replayed and create a read model per event
source, including sources whose events are unrelated to the declared `@fromEvent`
types. Other evolution policies may require you to initiate the replay;
`@notRewindable` projections only apply the new behavior from upgrade time onward.
Unrelated events can clear mapped properties when their payload lacks a value,
and removal events can still delete a read model.

The example below opts into the new all-event behavior. To keep the old behavior,
import `fromEvery` instead of `fromAll` and replace `@fromAll()` with `@fromEvery()`.

```typescript title="Convention-based fromAll property"
import { eventType, fromAll, fromEvent } from '@cratis/chronicle';
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

    @fromAll()
    version = 0;
}
```
