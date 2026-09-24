```typescript
import { count, decrement, eventType, increment } from '@cratis/chronicle';

// Events
@eventType()
export class MbConstantKeyProductPurchased {
    productId = '';
    amount = 0;
}

@eventType()
export class MbConstantKeyProductReturned {
    productId = '';
    amount = 0;
}

@eventType()
export class MbConstantKeyPageViewed {
    pageUrl = '';
}

// Global read model
export class MbConstantKeyStoreMetrics {
    @count(MbConstantKeyProductPurchased, 'store')
    totalPurchases = 0;

    @count(MbConstantKeyProductReturned, 'store')
    totalReturns = 0;

    @increment(MbConstantKeyProductPurchased, 'store')
    @decrement(MbConstantKeyProductReturned, 'store')
    netTransactions = 0;

    @count(MbConstantKeyPageViewed, 'store')
    totalPageViews = 0;
}
```
