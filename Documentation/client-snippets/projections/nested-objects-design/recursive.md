```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class NodRecursiveSliceCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class NodRecursiveCommandSet {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class NodRecursiveCommandCleared {
}

@eventType()
class NodRecursiveValidationConfigured {
    @field(String) readonly rules: string;

    constructor(rules: string) {
        this.rules = rules;
    }
}

@eventType()
class NodRecursiveValidationRemoved {
}

class NodRecursiveValidationItem {
    rules = '';
}

class NodRecursiveCommandItem {
    name = '';
    validation: NodRecursiveValidationItem | null = null;
}

class NodRecursiveSlice {
    name = '';
    command: NodRecursiveCommandItem | null = null;
}

@projection()
class NodRecursiveSliceProjection implements IProjectionFor<NodRecursiveSlice> {
    define(builder: IProjectionBuilderFor<NodRecursiveSlice>): void {
        builder
            .from(NodRecursiveSliceCreated)
            .nested<NodRecursiveCommandItem>(m => m.command, nested => nested
                .from(NodRecursiveCommandSet)
                .nested<NodRecursiveValidationItem>(m => m.validation, inner => inner
                    .from(NodRecursiveValidationConfigured)
                    .clearWith(NodRecursiveValidationRemoved))
                .clearWith(NodRecursiveCommandCleared));
    }
}
```
