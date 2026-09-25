```typescript
import { field, Guid as FundamentalsGuid } from '@cratis/fundamentals';
import { index } from '@cratis/chronicle';

class ReadModelsIndexingOrderLine {
    @field(FundamentalsGuid) @index() productId!: FundamentalsGuid;
    @field(Number) quantity!: number;
}

class ReadModelsIndexingOrderWithLines {
    @field(FundamentalsGuid) id!: FundamentalsGuid;
    @field(Array, { genericArguments: [ReadModelsIndexingOrderLine] }) lines!: ReadModelsIndexingOrderLine[];
}
```
