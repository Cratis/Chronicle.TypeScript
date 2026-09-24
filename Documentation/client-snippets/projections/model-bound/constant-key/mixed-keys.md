```typescript
import { count, eventType, fromEvent, Guid } from '@cratis/chronicle';

@eventType()
export class MbConstantKeyUserRegistered {
}

@eventType()
export class MbConstantKeyOrderPlacedGlobal {
}

@fromEvent(MbConstantKeyUserRegistered)
export class MbConstantKeyUserDashboard {
    id: Guid = Guid.empty;
    name = '';

    // A per-instance property alongside a constant-keyed one on the same read model
    @count(MbConstantKeyOrderPlacedGlobal, 'global-stats')
    platformTotalOrders = 0;
}
```
