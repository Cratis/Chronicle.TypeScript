```typescript
class PdlGroupMember {
    userId = '';
    name = '';
    role = '';
}

class PdlGroupReadModel {
    name = '';
    members: PdlGroupMember[] = [];
}
```
