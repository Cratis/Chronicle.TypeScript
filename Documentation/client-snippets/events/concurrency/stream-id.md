```typescript
import { eventType, IEventLog } from '@cratis/chronicle';

@eventType()
class ConcurrencyMonthlyReportGenerated {
    constructor(readonly month: string) {}
}

class ConcurrencyMonthlyReportService {
    constructor(private readonly eventLog: IEventLog) {}

    async generateMonthlyReport(accountId: string, month: Date): Promise<void> {
        const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

        await this.eventLog.appendMany([{
            eventSourceId: accountId,
            event: new ConcurrencyMonthlyReportGenerated(monthKey),
            eventStreamType: 'Reporting',
            eventStreamId: monthKey
        }], {
            concurrencyScope: {
                sequenceNumber: 5n,
                eventStreamType: 'Reporting',
                eventStreamId: monthKey
            }
        });
    }
}
```
