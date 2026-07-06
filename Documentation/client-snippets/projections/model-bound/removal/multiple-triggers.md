```typescript
import { eventType, Guid, readModel, removedWith, removedWithJoin, setFrom } from '@cratis/chronicle';

@eventType()
class MbRemovalMultipleAccountOpened {
    name = '';
}

@eventType()
class MbRemovalMultipleAccountClosed {
}

@eventType()
class MbRemovalMultipleAccountMerged {
    sourceAccountId: Guid = Guid.empty;
}

@eventType()
class MbRemovalMultipleOrganizationClosed {
}

@readModel()
@removedWith(MbRemovalMultipleAccountClosed)
@removedWith(MbRemovalMultipleAccountMerged, 'sourceAccountId')
@removedWithJoin(MbRemovalMultipleOrganizationClosed)
class MbRemovalMultipleAccount {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalMultipleAccountOpened, 'name')
    name = '';
}
```
