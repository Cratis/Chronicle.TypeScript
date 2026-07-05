```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecSetPropsAccountProjection implements IProjectionFor<DecSetPropsAccount> {
    define(builder: IProjectionBuilderFor<DecSetPropsAccount>): void {
        builder
            .from(DecSetPropsAccountOpened, _ => _
                .set(m => m.accountNumber).to(e => e.number)
                .set(m => m.customerName).to(e => e.owner.name)
                .set(m => m.balance).toValue(42.0)
                .set(m => m.isActive).toValue(true)
                .set(m => m.openedAt).to(e => e.timestamp))
            .from(DecSetPropsMoneyDeposited, _ => _
                .set(m => m.balance).to(e => e.amount)
                .set(m => m.lastTransaction).to(e => e.timestamp));
    }
}
```
