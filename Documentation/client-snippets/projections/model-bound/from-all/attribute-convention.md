<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

`@fromAll` currently aliases `@fromEvery`; this alias behavior is deprecated.
In the next major, @fromAll subscribes to every event type like fluent fromAll() and .NET [FromAll]; use @fromEvery to keep the current behavior.

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

    // Deprecated alias: use @fromEvery() to keep mapping only subscribed events.
    @fromAll()
    version = 0;
}
```
