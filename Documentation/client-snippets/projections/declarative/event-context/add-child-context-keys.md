```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecAddChildContextItemAdded {
    id = '';
}

class DecAddChildContextItem {
    id = '';
}

class DecAddChildContextOrder {
    lines: DecAddChildContextItem[] = [];
}

@projection()
class DecAddChildContextOrderProjection implements IProjectionFor<DecAddChildContextOrder> {
    define(builder: IProjectionBuilderFor<DecAddChildContextOrder>): void {
        builder.from(DecAddChildContextItemAdded, from => from
            .addChild(model => model.lines, child => child
                .identifiedBy(item => item.id)
                .usingKeyFromContext('sequenceNumber')
                .usingParentKeyFromContext('eventSourceId')));
    }
}
```
