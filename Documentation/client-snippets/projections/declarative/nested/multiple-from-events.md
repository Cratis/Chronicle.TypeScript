```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SliceCreatedForNestedUpdates {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class CommandSetForNestedUpdates {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
}

@eventType()
class CommandRenamedForNestedUpdates {
    @field(String) readonly newName: string;

    constructor(newName: string) {
        this.newName = newName;
    }
}

@eventType()
class CommandSchemaUpdatedForNestedUpdates {
    @field(String) readonly updatedSchema: string;

    constructor(updatedSchema: string) {
        this.updatedSchema = updatedSchema;
    }
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
