```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class SliceCreatedForNestedUpdates {
    constructor(readonly name: string) {}
}

@eventType()
class CommandSetForNestedUpdates {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandRenamedForNestedUpdates {
    constructor(readonly newName: string) {}
}

@eventType()
class CommandSchemaUpdatedForNestedUpdates {
    constructor(readonly updatedSchema: string) {}
}

@eventType()
class CommandClearedForNestedUpdates {
}

class CommandItemForNestedUpdates {
    name = '';
    schema = '';
}

class SliceForNestedUpdates {
    name = '';
    command: CommandItemForNestedUpdates | null = null;
}

@projection()
class SliceProjectionForNestedUpdates implements IProjectionFor<SliceForNestedUpdates> {
    define(builder: IProjectionBuilderFor<SliceForNestedUpdates>): void {
        builder
            .from(SliceCreatedForNestedUpdates)
            .nested<CommandItemForNestedUpdates>(m => m.command, nested => nested
                .from(CommandSetForNestedUpdates)
                .from(CommandRenamedForNestedUpdates, b => b
                    .set(m => m.name).to(e => e.newName))
                .from(CommandSchemaUpdatedForNestedUpdates, b => b
                    .set(m => m.schema).to(e => e.updatedSchema))
                .clearWith(CommandClearedForNestedUpdates));
    }
}
```
