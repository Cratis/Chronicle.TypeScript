```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SliceCreatedForNestedBasic {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class CommandSetForDeclarativeNestedBasic {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
}

@eventType()
class CommandClearedForDeclarativeNestedBasic {
}

class CommandItemForNestedBasic {
    name = '';
    schema = '';
}

class SliceForNestedBasic {
    name = '';
    command: CommandItemForNestedBasic | null = null;
}

@projection()
class SliceProjectionForNestedBasic implements IProjectionFor<SliceForNestedBasic> {
    define(builder: IProjectionBuilderFor<SliceForNestedBasic>): void {
        builder
            .from(SliceCreatedForNestedBasic)
            .nested(m => m.command, nested => nested
                .from(CommandSetForDeclarativeNestedBasic)
                .clearWith(CommandClearedForDeclarativeNestedBasic));
    }
}
```
