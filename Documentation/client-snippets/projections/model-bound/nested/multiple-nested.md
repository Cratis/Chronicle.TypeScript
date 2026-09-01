```typescript
import { clearWith, eventType, fromEvent, nested } from '@cratis/chronicle';

@eventType()
class CommandSetForNestedMultiple {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandClearedForNestedMultiple {
}

@eventType()
class ValidationConfiguredForNestedMultiple {
    constructor(readonly rules: string, readonly isStrict: boolean) {}
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
