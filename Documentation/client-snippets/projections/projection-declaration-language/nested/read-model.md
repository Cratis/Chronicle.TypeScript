```typescript
class PdlCommandItem {
    name = '';
    schema = '';
}

class PdlSliceReadModel {
    name = '';
    command: PdlCommandItem | null = null; // null until set
}
```
