```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecSetOnceDocumentRevised {
    title = '';
}

class DecSetOnceDocument {
    originalTitle = '';
    title = '';
    createdBy = '';
    created = new Date(0);
    lastRevised = new Date(0);
}

@projection()
class DecSetOnceDocumentProjection implements IProjectionFor<DecSetOnceDocument> {
    define(builder: IProjectionBuilderFor<DecSetOnceDocument>): void {
        builder
            .from(DecSetOnceDocumentRevised, _ => _
                .setOnce(m => m.originalTitle).to(e => e.title)
                .set(m => m.title).to(e => e.title)
                .setOnce(m => m.createdBy).toCausedBy('subject')
                .setOnce(m => m.created).toEventContextProperty('occurred')
                .set(m => m.lastRevised).toEventContextProperty('occurred'));
    }
}
```
