```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ProductListedWithNestedPromotion {
    @field(String) readonly name: string;
    @field(Number) readonly basePrice: number;

    constructor(name: string, basePrice: number) {
        this.name = name;
        this.basePrice = basePrice;
    }
}

@eventType()
class PromotionAppliedWithNestedPromotion {
    @field(String) readonly label: string;
    @field(Number) readonly discountPercent: number;
    @field(Date) readonly validUntil: Date;

    constructor(label: string, discountPercent: number, validUntil: Date) {
        this.label = label;
        this.discountPercent = discountPercent;
        this.validUntil = validUntil;
    }
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
