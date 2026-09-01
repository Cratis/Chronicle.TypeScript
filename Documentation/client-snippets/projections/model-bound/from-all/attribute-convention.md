```typescript title="Convention-based fromAll property"
import { eventType, fromAll, fromEvent, readModel } from '@cratis/chronicle';

@eventType()
class ProductRenamedFromAllConvention {
    constructor(
        readonly name: string,
        readonly version: number
    ) {}
}

@eventType()
class ProductPriceChangedFromAllConvention {
    constructor(
        readonly price: number,
        readonly version: number
    ) {}
}

@readModel()
@fromEvent(ProductRenamedFromAllConvention)
@fromEvent(ProductPriceChangedFromAllConvention)
class ProductVersionFromAllConvention {
    name = '';
    price = 0;

    @fromAll()
    version = 0;
}
```
