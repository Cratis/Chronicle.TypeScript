// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { ChildrenDefinitionLike, ProjectionBuilderCore } from './ProjectionBuilderCore';
import { IChildrenBuilder } from './IChildrenBuilder';
import { INestedBuilder } from './INestedBuilder';
import { ChildrenBuilder } from './ChildrenBuilder';

/**
 * Concrete implementation of {@link INestedBuilder}, building the `ChildrenDefinition` for a
 * nested single-object sub-projection reached through `.nested()`.
 * @template TParentReadModel - The parent read model type.
 * @template TNestedReadModel - The nested object read model type.
 */
export class NestedBuilder<TParentReadModel, TNestedReadModel>
    extends ProjectionBuilderCore<TNestedReadModel, INestedBuilder<TParentReadModel, TNestedReadModel>>
    implements INestedBuilder<TParentReadModel, TNestedReadModel> {
    /** @inheritdoc */
    clearWith(eventType: Function): INestedBuilder<TParentReadModel, TNestedReadModel> {
        const contractType = this.toContractEventType(eventType);
        this._removedWith.push({
            Key: contractType,
            Value: { Key: '$eventSourceId', ParentKey: '' }
        });
        return this;
    }

    /** @inheritdoc */
    children<TChildModel>(
        targetPropertyAccessor: PropertyAccessor<TNestedReadModel>,
        builderCallback: (builder: IChildrenBuilder<TNestedReadModel, TChildModel>) => void
    ): INestedBuilder<TParentReadModel, TNestedReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        targetPropertyAccessor(proxy as TNestedReadModel);

        const builder = new ChildrenBuilder<TNestedReadModel, TChildModel>();
        builderCallback(builder);
        this._children[handler.property] = builder.buildDefinition();
        return this;
    }

    /** @inheritdoc */
    nested<TGrandNestedModel>(
        targetPropertyAccessor: PropertyAccessor<TNestedReadModel>,
        builderCallback: (builder: INestedBuilder<TNestedReadModel, TGrandNestedModel>) => void
    ): INestedBuilder<TParentReadModel, TNestedReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        targetPropertyAccessor(proxy as TNestedReadModel);

        const builder = new NestedBuilder<TNestedReadModel, TGrandNestedModel>();
        builderCallback(builder);
        this._nested[handler.property] = builder.buildDefinition();
        return this;
    }

    /**
     * Builds the {@link ChildrenDefinitionLike} representing this nested object.
     * @returns The accumulated nested definition.
     */
    buildDefinition(): ChildrenDefinitionLike {
        return {
            IdentifiedBy: '',
            From: this._from,
            Join: this._join,
            Children: this._children,
            All: this._all,
            RemovedWith: this._removedWith,
            RemovedWithJoin: this._removedWithJoin,
            AutoMap: this._autoMap,
            Nested: this._nested
        };
    }
}
