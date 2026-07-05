```typescript
import { eventType, Guid, readModel, removedWith, setFrom } from '@cratis/chronicle';

@eventType()
class MbRemovalAccountOpened {
    name = '';
    balance = 0;
}

@eventType()
class MbRemovalAccountClosed {
}

@readModel()
@removedWith(MbRemovalAccountClosed)
class MbRemovalAccount {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalAccountOpened, 'name')
    name = '';

    @setFrom(MbRemovalAccountOpened, 'balance')
    balance = 0;
}
```
