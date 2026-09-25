```typescript
import { field, Guid as FundamentalsGuid } from '@cratis/fundamentals';
import { index } from '@cratis/chronicle';

class ReadModelsIndexingOrder {
    @field(FundamentalsGuid) id!: FundamentalsGuid;
    @field(FundamentalsGuid) @index() customerId!: FundamentalsGuid;
    @field(String) @index() number!: string;
    @field(Number) total!: number;
}
```
