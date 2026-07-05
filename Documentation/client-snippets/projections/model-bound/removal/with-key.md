```typescript
import { eventType, Guid, readModel, removedWith, setFrom } from '@cratis/chronicle';

@eventType()
class MbRemovalWithKeyAccountOpened {
    name = '';
}

@eventType()
class MbRemovalWithKeyAccountClosed {
    accountId: Guid = Guid.empty;
}

@readModel()
@removedWith(MbRemovalWithKeyAccountClosed, 'accountId')
class MbRemovalWithKeyAccount {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalWithKeyAccountOpened, 'name')
    name = '';
}
```
