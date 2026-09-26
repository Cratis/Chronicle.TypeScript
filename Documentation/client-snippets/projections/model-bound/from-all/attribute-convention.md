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
