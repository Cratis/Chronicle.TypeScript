```typescript
import { reducer } from '@cratis/chronicle';

class PassiveReducersSwitchableReadModel {
    value = 0;
}

// Was active, now passive
@reducer('', undefined, PassiveReducersSwitchableReadModel, false)
class PassiveReducersSwitchableReducer {
}
```
