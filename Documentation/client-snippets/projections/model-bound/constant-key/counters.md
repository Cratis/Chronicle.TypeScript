```typescript
import { count, decrement, eventType, increment, readModel } from '@cratis/chronicle';

@eventType()
class MbConstantKeyOrderPlacedForMetrics {
}

@eventType()
class MbConstantKeyUserLoggedIn {
}

@eventType()
class MbConstantKeyUserLoggedOut {
}

@eventType()
class MbConstantKeyErrorOccurred {
}

@readModel()
class MbConstantKeySystemMetrics {
    @count(MbConstantKeyOrderPlacedForMetrics, 'metrics')
    totalOrders = 0;

    @increment(MbConstantKeyUserLoggedIn, 'metrics')
    @decrement(MbConstantKeyUserLoggedOut, 'metrics')
    activeSessions = 0;

    @count(MbConstantKeyErrorOccurred, 'metrics')
    totalErrors = 0;
}
```
