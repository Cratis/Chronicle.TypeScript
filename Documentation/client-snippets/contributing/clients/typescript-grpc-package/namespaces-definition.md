```typescript
import { NamespacesDefinition } from '@cratis/chronicle.contracts';

const getNamespacesMethod = NamespacesDefinition.methods.getNamespaces;

console.log(`${NamespacesDefinition.fullName}.${getNamespacesMethod.name}`);
```
