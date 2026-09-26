```typescript
import { EventContext, ReactorServices, onceOnly, reactor } from '@cratis/chronicle';

@reactor()
class ScenariosReactStockKeepingExplicit {
    @onceOnly()
    async scenariosReactBookReserved(event: ScenariosReactBookReserved, context: EventContext, services: ReactorServices): Promise<void> {
        const result = await services.eventStore.eventLog.append(
            context.eventSourceId, new ScenariosReactStockDecreased(event.isbn, 1));
        if (!result.isSuccess) {
            throw new Error(`Stock could not be decreased for ISBN ${event.isbn}`);
        }
    }
}
```
