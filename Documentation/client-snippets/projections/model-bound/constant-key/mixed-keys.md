```typescript
import { count, eventType, fromEvent, Guid, readModel } from '@cratis/chronicle';

@eventType()
class MbConstantKeyUserRegistered {
}

@eventType()
class MbConstantKeyOrderPlacedGlobal {
}

@readModel()
@fromEvent(MbConstantKeyUserRegistered)
class MbConstantKeyUserDashboard {
    id: Guid = Guid.empty;
    name = '';

    // A per-instance property alongside a constant-keyed one on the same read model
    @count(MbConstantKeyOrderPlacedGlobal, 'global-stats')
    platformTotalOrders = 0;
}
```
