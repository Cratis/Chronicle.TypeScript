```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class PassiveReducersPaymentReceived {
    @field(String) readonly category: string;
    @field(Number) readonly amount: number;

    constructor(category: string, amount: number) {
        this.category = category;
        this.amount = amount;
    }
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
