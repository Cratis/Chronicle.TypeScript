```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class MbIndexAutoMapAccountOpened {
    name = '';
    balance = 0;
}

@projection()
class MbIndexAutoMapAccountProjection implements IProjectionFor<MbIndexAutoMapAccountInfo> {
    define(builder: IProjectionBuilderFor<MbIndexAutoMapAccountInfo>): void {
        builder.autoMap().from(MbIndexAutoMapAccountOpened);
    }
}

class MbIndexAutoMapAccountInfo {
    name = '';
    balance = 0;
}
```
