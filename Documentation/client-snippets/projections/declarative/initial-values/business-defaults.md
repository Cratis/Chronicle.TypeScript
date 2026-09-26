```typescript title="Business defaults"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

enum InitialValuesOrderStatus {
    Draft = 'Draft',
    Submitted = 'Submitted'
}

@eventType()
export class InitialValuesOrderSubmitted {
    @field(String) readonly customerName: string;
    @field(Number) readonly totalAmount: number;

    constructor(customerName: string, totalAmount: number) {
        this.customerName = customerName;
        this.totalAmount = totalAmount;
    }
}

export class InitialValuesOrderSummary {
    customerName = '';
    status = InitialValuesOrderStatus.Draft;
    totalAmount = 0;
    submittedAt = new Date(0);
    notes = 'No notes';
}

@projection('', InitialValuesOrderSummary)
export class InitialValuesOrderSummaryProjection implements IProjectionFor<InitialValuesOrderSummary> {
    define(builder: IProjectionBuilderFor<InitialValuesOrderSummary>): void {
        builder
            .withInitialValues(() => new InitialValuesOrderSummary())
            .from(InitialValuesOrderSubmitted, _ => _
                .set(m => m.status).toValue(InitialValuesOrderStatus.Submitted)
                .set(m => m.submittedAt).toEventContextProperty('occurred'));
    }
}
```
