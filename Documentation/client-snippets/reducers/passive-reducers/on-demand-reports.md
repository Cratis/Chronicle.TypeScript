```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class PassiveReducersPaymentReceived {
    constructor(readonly category: string, readonly amount: number) {}
}

class PassiveReducersMonthlyRevenueReport {
    totalRevenue = 0;
    revenueByCategory: Record<string, number> = {};
    month = 0;
    year = 0;
}

@reducer('', undefined, PassiveReducersMonthlyRevenueReport, false)
class PassiveReducersMonthlyRevenueReportReducer {
    passiveReducersPaymentReceived(
        event: PassiveReducersPaymentReceived,
        current: PassiveReducersMonthlyRevenueReport | undefined,
        context: EventContext
    ): PassiveReducersMonthlyRevenueReport {
        const revenue = current?.totalRevenue ?? 0;
        const byCategory = { ...(current?.revenueByCategory ?? {}) };

        byCategory[event.category] = (byCategory[event.category] ?? 0) + event.amount;

        return {
            totalRevenue: revenue + event.amount,
            revenueByCategory: byCategory,
            month: context.occurred.getMonth() + 1,
            year: context.occurred.getFullYear()
        };
    }
}
```
