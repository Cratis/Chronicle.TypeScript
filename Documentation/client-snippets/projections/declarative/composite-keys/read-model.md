```typescript
import { readModel } from '@cratis/chronicle';

@readModel()
class CompositeOrder {
    id = '';
    customerName = '';
    orderDate = new Date();
    shippedDate?: Date;
}
```
