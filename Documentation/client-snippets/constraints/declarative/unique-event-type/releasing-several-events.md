```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueEventTypeSeveralLoanCheckedOut {
    constructor(readonly title: string) {}
}

@eventType()
class ConstraintsUniqueEventTypeSeveralLoanReturned {
}

@eventType()
class ConstraintsUniqueEventTypeSeveralLoanWrittenOff {
}

@constraint()
class ConstraintsUniqueEventTypeSeveralOneOpenLoan implements IConstraint {
    // A loan is open until it is returned or written off. Both end the cycle, so the
    // borrower can take the next loan whichever way the previous one finished.
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueEventTypeSeveralLoanCheckedOut)
                .removedWith(ConstraintsUniqueEventTypeSeveralLoanReturned)
                .removedWith(ConstraintsUniqueEventTypeSeveralLoanWrittenOff));
    }
}
```
