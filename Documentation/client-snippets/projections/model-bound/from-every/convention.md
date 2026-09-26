```typescript title="Use the read model property name by convention"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ProductRenamedForEveryConvention {
    @field(String) readonly name: string;
    @field(Number) readonly version: number;

    constructor(name: string, version: number) {
        this.name = name;
        this.version = version;
    }
}

@eventType()
export class ProductPriceChangedForEveryConvention {
    @field(Number) readonly price: number;
    @field(Number) readonly version: number;

    constructor(price: number, version: number) {
        this.price = price;
        this.version = version;
    }
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
