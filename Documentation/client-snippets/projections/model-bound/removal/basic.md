```typescript
import { eventType, Guid, removedWith, setFrom } from '@cratis/chronicle';

@eventType()
export class MbRemovalAccountOpened {
    name = '';
    balance = 0;
}

@eventType()
export class MbRemovalAccountClosed {
}

@removedWith(MbRemovalAccountClosed)
export class MbRemovalAccount {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalAccountOpened, 'name')
    name = '';

    @setFrom(MbRemovalAccountOpened, 'balance')
    balance = 0;
}
```
