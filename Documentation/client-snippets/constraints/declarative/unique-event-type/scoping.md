```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueEventTypeScopedLoanCheckedOut {
    @field(String) readonly title: string;

    constructor(title: string) {
        this.title = title;
    }
}

@constraint()
class ConstraintsUniqueEventTypeOneLoanPerBranch implements IConstraint {
    // One checkout per borrower (event source) per branch (event stream).
    // The TypeScript uniqueFor API cannot configure a removal event yet,
    // so returning a loan does not release this constraint for another checkout.
    define(builder: IConstraintBuilder): void {
        builder
            .perEventStreamId()
            .uniqueFor(ConstraintsUniqueEventTypeScopedLoanCheckedOut);
    }
}
```
