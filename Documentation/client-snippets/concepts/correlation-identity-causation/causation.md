```typescript
import { causationManager, CausationType } from '@cratis/chronicle';

class CorrelationIdentityCausationCausation {
    recordPlaceOrder(orderId: string): void {
        causationManager.add(new CausationType('MyApp.Commands.PlaceOrder'), { orderId });
    }
}
```
