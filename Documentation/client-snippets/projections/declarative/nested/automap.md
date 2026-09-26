```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SliceCreatedForNestedAutoMap {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class CommandSetForNestedAutoMap {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
}

@eventType()
class CommandUpdatedForNestedAutoMap {
    @field(String) readonly schema: string;

    constructor(schema: string) {
        this.schema = schema;
    }
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
