```typescript title="Business defaults"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

enum InitialValuesOrderStatus {
    Draft = 'Draft',
    Submitted = 'Submitted'
}

@eventType()
export class InitialValuesOrderSubmitted {
    constructor(readonly customerName: string, readonly totalAmount: number) {}
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
