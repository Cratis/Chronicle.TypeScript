```typescript
import { eventType } from '@cratis/chronicle';

class DecSetPropsCustomer {
    name = '';
    email = '';
}

@eventType()
class DecSetPropsAccountOpened {
    number = '';
    owner = new DecSetPropsCustomer();
    timestamp = new Date();
}

@eventType()
class DecSetPropsMoneyDeposited {
    amount = 0;
    timestamp = new Date();
}
```
