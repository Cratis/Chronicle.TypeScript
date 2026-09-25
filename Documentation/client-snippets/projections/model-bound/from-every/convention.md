```typescript title="Use the read model property name by convention"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ProductRenamedForEveryConvention {
    constructor(readonly name: string, readonly version: number) {}
}

@eventType()
export class ProductPriceChangedForEveryConvention {
    constructor(readonly price: number, readonly version: number) {}
}

@fromEvent(ProductRenamedForEveryConvention)
@fromEvent(ProductPriceChangedForEveryConvention)
export class ProductVersionFromEveryConvention {
    @field(String) name = '';
    @field(Number) price = 0;

    @fromEvery()
    version = 0;
}
```
