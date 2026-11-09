```typescript
import { DictionaryKey, eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecDictionaryItemSold {
    category = '';
    quantity = 0;
}

@eventType()
class DecDictionaryItemReturned {
    category = '';
    quantity = 0;
}

class DecDictionarySales {
    unitsByCategory: Record<string, number> = {};
    salesByCategory: Record<string, number> = {};
    salesByUser: Record<string, number> = {};
    firstSaleByCategory: Record<string, Date> = {};
}

@projection()
class DecDictionarySalesProjection implements IProjectionFor<DecDictionarySales> {
    define(builder: IProjectionBuilderFor<DecDictionarySales>): void {
        builder
            .from(DecDictionaryItemSold, _ => _
                .add(m => m.unitsByCategory, e => e.category).with(e => e.quantity)
                .increment(m => m.salesByCategory, e => e.category)
                .count(m => m.salesByUser, DictionaryKey.causedBy('subject'))
                .setOnce(m => m.firstSaleByCategory, e => e.category).toEventContextProperty('occurred'))
            .from(DecDictionaryItemReturned, _ => _
                .subtract(m => m.unitsByCategory, e => e.category).with(e => e.quantity)
                .decrement(m => m.salesByCategory, e => e.category));
    }
}
```
