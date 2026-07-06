```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueEventTypeProjectInitialized {
}

@constraint()
class ConstraintsUniqueEventTypeProjectInitialization implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(ConstraintsUniqueEventTypeProjectInitialized);
    }
}
```
