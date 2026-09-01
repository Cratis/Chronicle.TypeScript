```typescript
import { eventType, IEventLog } from '@cratis/chronicle';

@eventType()
class ConcurrencyAccountSettingsUpdated {
    constructor(readonly settings: string) {}
}

class ConcurrencyAccountManagementService {
    constructor(private readonly eventLog: IEventLog) {}

    async updateAccountSettings(accountId: string, settings: string): Promise<void> {
        await this.eventLog.appendMany([{
            eventSourceId: accountId,
            event: new ConcurrencyAccountSettingsUpdated(settings),
            eventSourceType: 'BankAccount',
            eventStreamType: 'AccountManagement'
        }], {
            concurrencyScope: {
                sequenceNumber: 10n,
                eventSourceType: 'BankAccount',
                eventStreamType: 'AccountManagement'
            }
        });
    }
}
```
