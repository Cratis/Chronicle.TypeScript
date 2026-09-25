```typescript
import { EventContext, eventType, onceOnly, reactor, tag } from '@cratis/chronicle';

@eventType()
class TaggingReactorsProductStockChanged {
    constructor(readonly productId: string, readonly newQuantity: number) {}
}

interface TaggingReactorsInventoryApi {
    updateStock(productId: string, newQuantity: number): Promise<void>;
}

@reactor()
@tag('Integration')
@tag('ExternalAPI')
@tag('Inventory')
class TaggingReactorsInventorySyncReactor {
    constructor(private readonly inventoryApi: TaggingReactorsInventoryApi) {}

    @onceOnly()
    async taggingReactorsProductStockChanged(event: TaggingReactorsProductStockChanged, _context: EventContext): Promise<void> {
        await this.inventoryApi.updateStock(event.productId, event.newQuantity);
    }
}
```
