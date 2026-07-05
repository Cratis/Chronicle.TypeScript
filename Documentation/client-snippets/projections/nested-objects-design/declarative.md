```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class NodDeclarativeSliceCreated {
    constructor(readonly name: string) {}
}

@eventType()
class NodDeclarativeCommandSet {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class NodDeclarativeCommandCleared {
}

class NodDeclarativeCommandItem {
    name = '';
    schema = '';
}

class NodDeclarativeSlice {
    name = '';
    command: NodDeclarativeCommandItem | null = null;
}

@projection()
class NodDeclarativeSliceProjection implements IProjectionFor<NodDeclarativeSlice> {
    define(builder: IProjectionBuilderFor<NodDeclarativeSlice>): void {
        builder
            .from(NodDeclarativeSliceCreated)
            .nested(m => m.command, nested => nested
                .from(NodDeclarativeCommandSet)
                .clearWith(NodDeclarativeCommandCleared));
    }
}
```
