```typescript
import { EventContext, reactor } from '@cratis/chronicle';

@reactor()
class TaggingCatalogImportTracker {
    taggingCatalogItemImported(event: TaggingCatalogItemImported, context: EventContext): void {
        // Names and values compare exactly (case-sensitive).
        // A name can carry more than one value, so read every match.
        const batchIds = (context.namedTags ?? [])
            .filter(tag => tag.name === 'import-batch')
            .map(tag => tag.value);

        console.log(`${event.sku} imported in batch(es) ${batchIds.join(', ')}`);
    }
}
```
