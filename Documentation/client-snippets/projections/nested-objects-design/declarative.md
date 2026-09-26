```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class NodDeclarativeSliceCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class NodDeclarativeCommandSet {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
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
