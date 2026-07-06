```typescript title="Business defaults"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

enum InitialValuesOrderStatus {
    Draft = 'Draft',
    Submitted = 'Submitted'
}

@eventType()
class InitialValuesOrderSubmitted {
    constructor(readonly customerName: string, readonly totalAmount: number) {}
}

@readModel()
class InitialValuesOrderSummary {
    customerName = '';
    status = InitialValuesOrderStatus.Draft;
    totalAmount = 0;
    submittedAt = new Date(0);
    notes = 'No notes';
}

@projection('', InitialValuesOrderSummary)
class InitialValuesOrderSummaryProjection implements IProjectionFor<InitialValuesOrderSummary> {
    define(builder: IProjectionBuilderFor<InitialValuesOrderSummary>): void {
        builder
            .withInitialValues(() => new InitialValuesOrderSummary())
            .from(InitialValuesOrderSubmitted, _ => _
                .set(m => m.status).toValue(InitialValuesOrderStatus.Submitted)
                .set(m => m.submittedAt).toEventContextProperty('occurred'));
    }
}
```
