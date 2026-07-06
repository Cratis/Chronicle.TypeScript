```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class MbIndexExplicitAccountOpened {
    name = '';
    initialBalance = 0;
}

@projection()
class MbIndexExplicitAccountProjection implements IProjectionFor<MbIndexExplicitAccountInfo> {
    define(builder: IProjectionBuilderFor<MbIndexExplicitAccountInfo>): void {
        builder.from(MbIndexExplicitAccountOpened, _ => _
            .set(m => m.name).to(e => e.name)
            .set(m => m.balance).to(e => e.initialBalance));
    }
}

class MbIndexExplicitAccountInfo {
    name = '';
    balance = 0;
}
```
