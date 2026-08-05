// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { ChildrenDefinitionLike, ProjectionBuilderCore } from './ProjectionBuilderCore';
import { IChildrenBuilder } from './IChildrenBuilder';
import { INestedBuilder } from './INestedBuilder';
import { NestedBuilder } from './NestedBuilder';

/**
 * Concrete implementation of {@link IChildrenBuilder}, building the `ChildrenDefinition` for a
 * children collection sub-projection reached through `.children()`.
 * @template TParentReadModel - The parent read model type.
 * @template TChildReadModel - The child read model type.
 */
export class ChildrenBuilder<TParentReadModel, TChildReadModel>
    extends ProjectionBuilderCore<TChildReadModel, IChildrenBuilder<TParentReadModel, TChildReadModel>>
    implements IChildrenBuilder<TParentReadModel, TChildReadModel> {
    private _identifiedBy: string | undefined;
    private _fromEventPropertyPath: string | undefined;

    /** @inheritdoc */
    identifiedBy(propertyAccessor: PropertyAccessor<TChildReadModel>): IChildrenBuilder<TParentReadModel, TChildReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        propertyAccessor(proxy as TChildReadModel);
        this._identifiedBy = handler.property;
        return this;
    }

    /** @inheritdoc */
    fromEventProperty<TEvent>(propertyAccessor: PropertyAccessor<TEvent>): IChildrenBuilder<TParentReadModel, TChildReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        propertyAccessor(proxy as TEvent);
        this._fromEventPropertyPath = handler.property;
        return this;
    }

    /** @inheritdoc */
    children<TGrandchildModel>(
        targetPropertyAccessor: PropertyAccessor<TChildReadModel>,
        builderCallback: (builder: IChildrenBuilder<TChildReadModel, TGrandchildModel>) => void
    ): IChildrenBuilder<TParentReadModel, TChildReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        targetPropertyAccessor(proxy as TChildReadModel);

        const builder = new ChildrenBuilder<TChildReadModel, TGrandchildModel>();
        builderCallback(builder);
        this._children[handler.property] = builder.buildDefinition();
        return this;
    }

    /** @inheritdoc */
    nested<TNestedModel>(
        targetPropertyAccessor: PropertyAccessor<TChildReadModel>,
        builderCallback: (builder: INestedBuilder<TChildReadModel, TNestedModel>) => void
    ): IChildrenBuilder<TParentReadModel, TChildReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        targetPropertyAccessor(proxy as TChildReadModel);

        const builder = new NestedBuilder<TChildReadModel, TNestedModel>();
        builderCallback(builder);
        this._nested[handler.property] = builder.buildDefinition();
        return this;
    }

    /**
     * Builds the {@link ChildrenDefinitionLike} representing this children collection.
     * @returns The accumulated children definition.
     */
    buildDefinition(): ChildrenDefinitionLike {
        return {
            IdentifiedBy: this._identifiedBy ?? '$eventSourceId',
            From: this._from,
            Join: this._join,
            Children: this._children,
            All: this._all,
            FromEventProperty: this._fromEventPropertyPath === undefined
                ? undefined
                : { Event: undefined, PropertyExpression: this._fromEventPropertyPath },
            RemovedWith: this._removedWith,
            RemovedWithJoin: this._removedWithJoin,
            AutoMap: this._autoMap,
            Nested: this._nested
        };
    }
}
