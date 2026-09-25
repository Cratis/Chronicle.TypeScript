```typescript title="Convention-based fromAll property"
import { eventType, fromAll, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ProductRenamedFromAllConvention {
    constructor(
        readonly name: string,
        readonly version: number
    ) {}
}

@eventType()
export class ProductPriceChangedFromAllConvention {
    constructor(
        readonly price: number,
        readonly version: number
    ) {}
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
