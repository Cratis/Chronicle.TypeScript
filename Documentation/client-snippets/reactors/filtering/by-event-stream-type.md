```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventStreamType, Guid, IEventLog, reactor } from '@cratis/chronicle';

@eventType()
class ReactorsFilteringPaymentCaptured {
    @field(Number) amount = 0;
}

class ReactorsFilteringPaymentsService {
    constructor(private readonly eventLog: IEventLog) {}

    async capture(amount: number): Promise<void> {
        const result = await this.eventLog.append(Guid.create().toString(),
            Object.assign(new ReactorsFilteringPaymentCaptured(), { amount }),
            { streamType: 'payments' });
        if (!result.isSuccess) throw new Error('Payment capture failed');
    }
}

@reactor()
@eventStreamType('payments')
class ReactorsFilteringPaymentReceivedNotifier {
    reactorsFilteringPaymentCaptured(event: ReactorsFilteringPaymentCaptured): void {
        console.log(`Payment received: ${event.amount}`);
    }
}
```
