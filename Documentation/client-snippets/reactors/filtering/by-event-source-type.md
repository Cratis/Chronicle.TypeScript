```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventSourceType, Guid, IEventLog, reactor } from '@cratis/chronicle';

@eventType()
class ReactorsFilteringCustomerRegistered {
    @field(String) emailAddress = '';
}

class ReactorsFilteringCustomerService {
    constructor(private readonly eventLog: IEventLog) {}

    async register(emailAddress: string): Promise<void> {
        const result = await this.eventLog.append(Guid.create().toString(),
            Object.assign(new ReactorsFilteringCustomerRegistered(), { emailAddress }),
            { sourceType: 'customer' });
        if (!result.isSuccess) throw new Error('Customer registration failed');
    }
}

@reactor()
@eventSourceType('customer')
class ReactorsFilteringCustomerWelcomeReactor {
    reactorsFilteringCustomerRegistered(event: ReactorsFilteringCustomerRegistered): void {
        console.log(`Welcome ${event.emailAddress}`);
    }
}
```
