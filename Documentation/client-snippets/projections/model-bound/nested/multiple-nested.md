```typescript
import { clearWith, eventType, fromEvent, nested } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CommandSetForNestedMultiple {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
}

@eventType()
class CommandClearedForNestedMultiple {
}

@eventType()
class ValidationConfiguredForNestedMultiple {
    @field(String) readonly rules: string;
    @field(Boolean) readonly isStrict: boolean;

    constructor(rules: string, isStrict: boolean) {
        this.rules = rules;
        this.isStrict = isStrict;
    }
}

@eventType()
class ValidationRemovedForNestedMultiple {
}

@fromEvent(CommandSetForNestedMultiple)
@clearWith(CommandClearedForNestedMultiple)
class CommandItemNestedMultiple {
    name = '';
    schema = '';
}

@fromEvent(ValidationConfiguredForNestedMultiple)
@clearWith(ValidationRemovedForNestedMultiple)
class ValidationConfigNestedMultiple {
    rules = '';
    isStrict = false;
}

class SliceWithMultipleNestedObjects {
    name = '';

    @nested
    command: CommandItemNestedMultiple | null = null;

    @nested
    validation: ValidationConfigNestedMultiple | null = null;
}
```
