```typescript
import { field, Constructor } from '@cratis/fundamentals';
import { eventType, IClientArtifactsProvider, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class StructuralDepsBookBorrowed {
    @field(String) readonly bookId: string;

    constructor(bookId: string) {
        this.bookId = bookId;
    }
}

@eventType()
class StructuralDepsBookReturned {
    @field(String) readonly bookId: string;

    constructor(bookId: string) {
        this.bookId = bookId;
    }
}

class StructuralDepsBorrowedBook {
    bookId = '';
}

@projection()
class StructuralDepsBorrowedBooksProjection implements IProjectionFor<StructuralDepsBorrowedBook> {
    define(builder: IProjectionBuilderFor<StructuralDepsBorrowedBook>): void {
        builder.from(StructuralDepsBookBorrowed, _ => _
            .set(m => m.bookId).to(e => e.bookId));
    }
}

class StructuralDepsMyArtifactsProvider implements IClientArtifactsProvider {
    readonly eventTypes: Constructor[] = [StructuralDepsBookBorrowed, StructuralDepsBookReturned];
    readonly readModels: Constructor[] = [];
    readonly reactors: Constructor[] = [];
    readonly reducers: Constructor[] = [];
    readonly seeders: Constructor[] = [];
    readonly constraints: Constructor[] = [];
    readonly projections: Constructor[] = [StructuralDepsBorrowedBooksProjection];
    readonly webhooks: Constructor[] = [];
    readonly eventTypeMigrations: Constructor[] = [];
    readonly globalForHandlers: Constructor[] = [];
}
```
