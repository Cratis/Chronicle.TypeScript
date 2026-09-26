```typescript
import { EventContext, eventType, onceOnly, reactor, tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaggingReactorsProductStockChanged {
    @field(String) readonly productId: string;
    @field(Number) readonly newQuantity: number;

    constructor(productId: string, newQuantity: number) {
        this.productId = productId;
        this.newQuantity = newQuantity;
    }
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
