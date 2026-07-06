```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueEventTypeNamedProjectInitialized {
}

@constraint()
class ConstraintsUniqueEventTypeNamedProjectInitialization implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(
            ConstraintsUniqueEventTypeNamedProjectInitialized,
            'A project can only be initialized once.',
            'UniqueProjectInitialization');
    }
}
```
