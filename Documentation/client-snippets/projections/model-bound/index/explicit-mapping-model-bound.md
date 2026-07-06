```typescript
import { Guid, setFrom } from '@cratis/chronicle';

class MbIndexExplicitMbAccountInfo {
    id: Guid = Guid.empty;

    @setFrom(MbIndexExplicitAccountOpened, 'name')
    name = '';

    @setFrom(MbIndexExplicitAccountOpened, 'initialBalance')
    balance = 0;
}
```
