```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueEventTypeShiftStarted {
    constructor(readonly location: string) {}
}

@eventType()
class ConstraintsUniqueEventTypeShiftEnded {
}

@constraint()
class ConstraintsUniqueEventTypeOneOpenShift implements IConstraint {
    // At most one open shift per employee. Ending the shift releases the constraint,
    // so the next shift is allowed - without it the constraint could only say
    // "at most one, ever", and the employee's second shift would be refused forever.
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueEventTypeShiftStarted)
                .removedWith(ConstraintsUniqueEventTypeShiftEnded));
    }
}
```
