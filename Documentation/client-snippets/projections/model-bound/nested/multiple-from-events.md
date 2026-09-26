```typescript
import { clearWith, eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CommandSetForNestedMultipleFrom {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
}

@eventType()
class CommandRenamedForNestedMultipleFrom {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class CommandSchemaUpdatedForNestedMultipleFrom {
    @field(String) readonly schema: string;

    constructor(schema: string) {
        this.schema = schema;
    }
}

@eventType()
class CommandClearedForNestedMultipleFrom {
}

@fromEvent(CommandSetForNestedMultipleFrom)
@fromEvent(CommandRenamedForNestedMultipleFrom)
@fromEvent(CommandSchemaUpdatedForNestedMultipleFrom)
@clearWith(CommandClearedForNestedMultipleFrom)
class CommandItemNestedMultipleFrom {
    name = '';
    schema = '';
}
```
