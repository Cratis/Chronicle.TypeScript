```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class NodRecursiveSliceCreated {
    constructor(readonly name: string) {}
}

@eventType()
class NodRecursiveCommandSet {
    constructor(readonly name: string) {}
}

@eventType()
class NodRecursiveCommandCleared {
}

@eventType()
class NodRecursiveValidationConfigured {
    constructor(readonly rules: string) {}
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
