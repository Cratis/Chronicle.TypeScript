```typescript
import { tag } from '@cratis/chronicle';

@tag('Reporting', 'Analytics')
class TaggingConceptsSalesReport {
    constructor(readonly totalSales: number, readonly orderCount: number) {}
}
```
