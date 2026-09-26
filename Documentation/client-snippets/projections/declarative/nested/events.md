```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SliceCreatedForNestedEvents {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class CommandSetForNestedEvents {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
}

@eventType()
class CommandClearedForNestedEvents {
}
```
