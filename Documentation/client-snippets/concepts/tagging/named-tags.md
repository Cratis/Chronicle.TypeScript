```typescript
import { eventType, IEventStore, NamedTag, tag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
@tag('catalog')
class TaggingCatalogItemImported {
    @field(String) readonly sku: string;
    @field(String) readonly title: string;

    constructor(sku: string, title: string) {
        this.sku = sku;
        this.title = title;
    }
}

class TaggingCatalogImportService {
    constructor(private readonly store: IEventStore) {}

    // Plain tags: ['catalog', 'import']
    // Named tags: import-batch = <batchId>, source-system = erp
    async import(itemId: string, sku: string, title: string, batchId: string): Promise<void> {
        await this.store.eventLog.append(
            itemId,
            new TaggingCatalogItemImported(sku, title),
            {
                namedTags: [new NamedTag('import-batch', batchId), new NamedTag('source-system', 'erp')],
                tags: ['import']
            });
    }
}
```
