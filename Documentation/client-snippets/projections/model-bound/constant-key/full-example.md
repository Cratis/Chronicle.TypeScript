```typescript
import { count, decrement, eventType, increment, readModel } from '@cratis/chronicle';

// Events
@eventType()
class MbConstantKeyProductPurchased {
    productId = '';
    amount = 0;
}

@eventType()
class MbConstantKeyProductReturned {
    productId = '';
    amount = 0;
}

@eventType()
class MbConstantKeyPageViewed {
    pageUrl = '';
}

// Global read model
@readModel()
class MbConstantKeyStoreMetrics {
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
