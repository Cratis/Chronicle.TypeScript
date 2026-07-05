```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueEventTypeMessageProjectInitialized {
}

@constraint()
class ConstraintsUniqueEventTypeMessageProjectInitialization implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(ConstraintsUniqueEventTypeMessageProjectInitialized, 'A project can only be initialized once.');
    }
}
```
