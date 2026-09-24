```typescript
import { eventType, Guid, join, removedWithJoin, setFrom } from '@cratis/chronicle';

@eventType()
export class MbRemovalJoinClassEmployeeHired {
    name = '';
}

@eventType()
export class MbRemovalJoinClassCompanyRegistered {
    name = '';
}

@eventType()
export class MbRemovalJoinClassCompanyDissolved {
}

@removedWithJoin(MbRemovalJoinClassCompanyDissolved)
export class MbRemovalJoinClassEmployee {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalJoinClassEmployeeHired, 'name')
    name = '';

    @join(MbRemovalJoinClassCompanyRegistered, undefined, 'name')
    companyName = '';
}
```
