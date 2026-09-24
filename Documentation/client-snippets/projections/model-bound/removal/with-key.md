```typescript
import { eventType, Guid, removedWith, setFrom } from '@cratis/chronicle';

@eventType()
export class MbRemovalWithKeyAccountOpened {
    name = '';
}

@eventType()
export class MbRemovalWithKeyAccountClosed {
    accountId: Guid = Guid.empty;
}

@removedWith(MbRemovalWithKeyAccountClosed, 'accountId')
export class MbRemovalWithKeyAccount {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalWithKeyAccountOpened, 'name')
    name = '';
}
```
