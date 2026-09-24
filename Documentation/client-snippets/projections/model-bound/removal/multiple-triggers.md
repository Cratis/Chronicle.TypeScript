```typescript
import { eventType, Guid, removedWith, removedWithJoin, setFrom } from '@cratis/chronicle';

@eventType()
export class MbRemovalMultipleAccountOpened {
    name = '';
}

@eventType()
export class MbRemovalMultipleAccountClosed {
}

@eventType()
export class MbRemovalMultipleAccountMerged {
    sourceAccountId: Guid = Guid.empty;
}

@eventType()
export class MbRemovalMultipleOrganizationClosed {
}

@removedWith(MbRemovalMultipleAccountClosed)
@removedWith(MbRemovalMultipleAccountMerged, 'sourceAccountId')
@removedWithJoin(MbRemovalMultipleOrganizationClosed)
export class MbRemovalMultipleAccount {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalMultipleAccountOpened, 'name')
    name = '';
}
```
