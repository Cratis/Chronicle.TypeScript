```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecSetPropsCombinedAccountProjection implements IProjectionFor<DecSetPropsAccount> {
    define(builder: IProjectionBuilderFor<DecSetPropsAccount>): void {
        builder
            .autoMap()  // Automatically maps matching properties
            .from(DecSetPropsAccountOpened, _ => _
                .set(m => m.customerName).to(e => e.owner.name)  // Custom mapping for nested property
                .set(m => m.isActive).toValue(true))             // Custom mapping for constant
            .from(DecSetPropsMoneyDeposited);  // Uses AutoMap for all properties
    }
}
```
