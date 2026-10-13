```typescript
import { IProjectionBuilderFor, IProjectionFor, pii, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class ChoosingStyleBookStatusFluent {
    id = '';
    @field(String) title: string | null = null;
    @field(String) isbn: string | null = null;
    isBorrowed = false;
    @pii() @field(String) borrowedBy: string | null = null;
}

@projection('', ChoosingStyleBookStatusFluent)
class ChoosingStyleBookStatusProjection implements IProjectionFor<ChoosingStyleBookStatusFluent> {
    define(builder: IProjectionBuilderFor<ChoosingStyleBookStatusFluent>): void {
        builder
            .from(ChoosingStyleBookRegistered, _ => _
                .set(m => m.id).toEventSourceId()
                .set(m => m.title).to(e => e.title)
                .set(m => m.isbn).to(e => e.isbn)
                .set(m => m.isBorrowed).toValue(false)
                .set(m => m.borrowedBy).toValue(null))
            .from(ChoosingStyleBookBorrowed, _ => _
                .set(m => m.id).toEventSourceId()
                .set(m => m.isBorrowed).toValue(true)
                .set(m => m.borrowedBy).to(e => e.memberName))
            .from(ChoosingStyleBookReturned, _ => _
                .set(m => m.id).toEventSourceId()
                .set(m => m.isBorrowed).toValue(false)
                .set(m => m.borrowedBy).toValue(null));
    }
}
```
