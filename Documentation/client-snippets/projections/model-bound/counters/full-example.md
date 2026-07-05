```typescript
import { addFrom, count, decrement, eventType, Guid, increment, readModel, subtractFrom } from '@cratis/chronicle';

// Events
@eventType()
class MbCountersUserLoggedInFull {
    timestamp = new Date();
}

@eventType()
class MbCountersUserLoggedOutFull {
    timestamp = new Date();
}

@eventType()
class MbCountersPurchaseMade {
    amount = 0;
}

@eventType()
class MbCountersRefundIssued {
    amount = 0;
}

// Read Model
@readModel()
class MbCountersUserActivity {
    id: Guid = Guid.empty;

    // Track login/logout counts
    @count(MbCountersUserLoggedInFull)
    totalLogins = 0;

    @count(MbCountersUserLoggedOutFull)
    totalLogouts = 0;

    // Track active sessions
    @increment(MbCountersUserLoggedInFull)
    @decrement(MbCountersUserLoggedOutFull)
    activeSessions = 0;

    // Track transaction counts
    @count(MbCountersPurchaseMade)
    purchaseCount = 0;

    @count(MbCountersRefundIssued)
    refundCount = 0;

    // Track transaction values
    @addFrom(MbCountersPurchaseMade, 'amount')
    @subtractFrom(MbCountersRefundIssued, 'amount')
    netSpent = 0;
}
```
