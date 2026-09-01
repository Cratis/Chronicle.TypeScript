```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class SliceCreatedForNestedAutoMap {
    constructor(readonly name: string) {}
}

@eventType()
class CommandSetForNestedAutoMap {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandUpdatedForNestedAutoMap {
    constructor(readonly schema: string) {}
}

@eventType()
class CommandClearedForNestedAutoMap {
}

class CommandItemForNestedAutoMap {
    name = '';
    schema = '';
}

class SliceForNestedAutoMap {
    name = '';
    command: CommandItemForNestedAutoMap | null = null;
}

@projection()
class SliceProjectionForNestedAutoMap implements IProjectionFor<SliceForNestedAutoMap> {
    define(builder: IProjectionBuilderFor<SliceForNestedAutoMap>): void {
        builder
            .from(SliceCreatedForNestedAutoMap)
            .nested(m => m.command, nested => nested
                .from(CommandSetForNestedAutoMap)
                .from(CommandUpdatedForNestedAutoMap)
                .clearWith(CommandClearedForNestedAutoMap));
    }
}
```
