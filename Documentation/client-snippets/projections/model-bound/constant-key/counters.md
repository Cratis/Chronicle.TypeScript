```typescript
import { count, decrement, eventType, increment } from '@cratis/chronicle';

@eventType()
export class MbConstantKeyOrderPlacedForMetrics {
}

@eventType()
export class MbConstantKeyUserLoggedIn {
}

@eventType()
export class MbConstantKeyUserLoggedOut {
}

@eventType()
export class MbConstantKeyErrorOccurred {
}

export class MbConstantKeySystemMetrics {
    @count(MbConstantKeyOrderPlacedForMetrics, 'metrics')
    totalOrders = 0;

    @increment(MbConstantKeyUserLoggedIn, 'metrics')
    @decrement(MbConstantKeyUserLoggedOut, 'metrics')
    activeSessions = 0;

    @count(MbConstantKeyErrorOccurred, 'metrics')
    totalErrors = 0;
}
```
