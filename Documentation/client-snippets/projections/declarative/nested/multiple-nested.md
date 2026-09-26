```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SliceCreatedWithMultipleNested {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class CommandSetWithMultipleNested {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
}

@eventType()
class CommandClearedWithMultipleNested {
}

@eventType()
class ValidationConfiguredWithMultipleNested {
    @field(String) readonly ruleName: string;

    constructor(ruleName: string) {
        this.ruleName = ruleName;
    }
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
