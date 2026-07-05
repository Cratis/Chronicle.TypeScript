```typescript
import { eventType, Guid, join, readModel, removedWithJoin, setFrom } from '@cratis/chronicle';

@eventType()
class MbRemovalJoinClassEmployeeHired {
    name = '';
}

@eventType()
class MbRemovalJoinClassCompanyRegistered {
    name = '';
}

@eventType()
class MbRemovalJoinClassCompanyDissolved {
}

@readModel()
@removedWithJoin(MbRemovalJoinClassCompanyDissolved)
class MbRemovalJoinClassEmployee {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalJoinClassEmployeeHired, 'name')
    name = '';

    @join(MbRemovalJoinClassCompanyRegistered, undefined, 'name')
    companyName = '';
}
```
