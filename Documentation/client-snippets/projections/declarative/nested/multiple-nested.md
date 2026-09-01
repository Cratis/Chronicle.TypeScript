```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class SliceCreatedWithMultipleNested {
    constructor(readonly name: string) {}
}

@eventType()
class CommandSetWithMultipleNested {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandClearedWithMultipleNested {
}

@eventType()
class ValidationConfiguredWithMultipleNested {
    constructor(readonly ruleName: string) {}
}

@eventType()
class ValidationRemovedWithMultipleNested {
}

class CommandItemWithMultipleNested {
    name = '';
    schema = '';
}

class ValidationConfigWithMultipleNested {
    ruleName = '';
}

class SliceWithMultipleNested {
    name = '';
    command: CommandItemWithMultipleNested | null = null;
    validation: ValidationConfigWithMultipleNested | null = null;
}

@projection()
class SliceProjectionWithMultipleNested implements IProjectionFor<SliceWithMultipleNested> {
    define(builder: IProjectionBuilderFor<SliceWithMultipleNested>): void {
        builder
            .from(SliceCreatedWithMultipleNested)
            .nested(m => m.command, nested => nested
                .from(CommandSetWithMultipleNested)
                .clearWith(CommandClearedWithMultipleNested))
            .nested(m => m.validation, nested => nested
                .from(ValidationConfiguredWithMultipleNested)
                .clearWith(ValidationRemovedWithMultipleNested));
    }
}
```
