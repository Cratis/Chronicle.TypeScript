```typescript title="Use the read model property name by convention"
import { eventType, fromEvent, fromEvery, readModel } from '@cratis/chronicle';

@eventType()
class ProductRenamedForEveryConvention {
    constructor(readonly name: string, readonly version: number) {}
}

@eventType()
class ProductPriceChangedForEveryConvention {
    constructor(readonly price: number, readonly version: number) {}
}

@readModel()
@fromEvent(ProductRenamedForEveryConvention)
@fromEvent(ProductPriceChangedForEveryConvention)
class ProductVersionFromEveryConvention {
    name = '';
    price = 0;

    @fromEvery()
    version = 0;
}
```
