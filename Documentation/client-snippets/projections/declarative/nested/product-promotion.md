```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class ProductListedWithNestedPromotion {
    constructor(readonly name: string, readonly basePrice: number) {}
}

@eventType()
class PromotionAppliedWithNestedPromotion {
    constructor(readonly label: string, readonly discountPercent: number, readonly validUntil: Date) {}
}

@eventType()
class PromotionRemovedWithNestedPromotion {
}

class PromotionForNestedProduct {
    label = '';
    discountPercent = 0;
    validUntil = new Date();
}

class ProductWithNestedPromotion {
    name = '';
    basePrice = 0;
    promotion: PromotionForNestedProduct | null = null;
}

@projection()
class ProductProjectionWithNestedPromotion implements IProjectionFor<ProductWithNestedPromotion> {
    define(builder: IProjectionBuilderFor<ProductWithNestedPromotion>): void {
        builder
            .from(ProductListedWithNestedPromotion)
            .nested(m => m.promotion, promotion => promotion
                .from(PromotionAppliedWithNestedPromotion)
                .clearWith(PromotionRemovedWithNestedPromotion));
    }
}
```
