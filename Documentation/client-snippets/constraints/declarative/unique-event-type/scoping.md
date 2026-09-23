```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueEventTypeScopedLoanCheckedOut {
    constructor(readonly title: string) {}
}

@eventType()
class ConstraintsUniqueEventTypeScopedLoanReturned {
}

@constraint()
class ConstraintsUniqueEventTypeOneOpenLoanPerBranch implements IConstraint {
    // One open loan per borrower per branch. The stream the event is appended to decides
    // which cycle it belongs to, so the same borrower can hold one open loan at every
    // branch, and returning at one branch opens the next cycle only there.
    define(builder: IConstraintBuilder): void {
        builder
            .perEventStreamId()
            .unique(unique =>
                unique
                    .on(ConstraintsUniqueEventTypeScopedLoanCheckedOut)
                    .removedWith(ConstraintsUniqueEventTypeScopedLoanReturned));
    }
}
```
