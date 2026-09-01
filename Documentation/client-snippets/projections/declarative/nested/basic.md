```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class SliceCreatedForNestedBasic {
    constructor(readonly name: string) {}
}

@eventType()
class CommandSetForDeclarativeNestedBasic {
    constructor(readonly name: string, readonly schema: string) {}
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
