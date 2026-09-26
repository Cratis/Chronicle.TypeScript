```typescript
import { tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@tag('Reporting', 'Analytics')
class TaggingConceptsSalesReport {
    @field(Number) readonly totalSales: number;
    @field(Number) readonly orderCount: number;

    constructor(totalSales: number, orderCount: number) {
        this.totalSales = totalSales;
        this.orderCount = orderCount;
    }
}
```
