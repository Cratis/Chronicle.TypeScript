// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { addFrom, getAddFromMetadata } from './addFrom.js';
import { childrenFrom, getChildrenFromMetadata } from './childrenFrom.js';
import { clearWith, getClearWithPropertyMetadata } from './clearWith.js';
import { count, getCountMetadata } from './count.js';
import { decrement, getDecrementMetadata } from './decrement.js';
import { fromAll, getFromAllMetadata } from './fromAll.js';
import { fromEvery, getFromEveryMetadata } from './fromEvery.js';
import { increment, getIncrementMetadata } from './increment.js';
import { join, getJoinMetadata } from './join.js';
import { isNested, nested } from './nested.js';
import { isNoAutoMap, isPropertyNoAutoMap, noAutoMap } from './noAutoMap.js';
import { getRemovedWithPropertyMetadata, removedWith } from './removedWith.js';
import { getRemovedWithJoinPropertyMetadata, removedWithJoin } from './removedWithJoin.js';
import { getSetFromContextMetadata, setFromContext } from './setFromContext.js';
import { getSetFromMetadata, setFrom } from './setFrom.js';
import { getSetValueMetadata, setValue } from './setValue.js';
import { getSubtractFromMetadata, subtractFrom } from './subtractFrom.js';
import { getTrackedJsonSchemaProperties, jsonSchemaProperty } from '../../schemas/jsonSchemaProperty.js';
import { DecoratorType } from '../../types/DecoratorType.js';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';
import { DefaultClientArtifactsProvider } from '../../artifacts/DefaultClientArtifactsProvider.js';
import { ReadModels } from '../../readModels/ReadModels.js';
import type { ChronicleConnection } from '../../connection/ChronicleConnection.js';
import { vi } from 'vitest';

class Changed {}

@noAutoMap
class Mappings {
    @addFrom(Changed) added!: number;
    @childrenFrom(Changed) children!: object[];
    @clearWith(Changed) cleared!: string;
    @count(Changed) counted!: number;
    @decrement(Changed) decremented!: number;
    @fromAll() all!: string;
    @fromEvery() every!: string;
    @increment(Changed) incremented!: number;
    @join(Changed) joined!: string;
    @nested nestedValue!: object;
    @noAutoMap excluded!: string;
    @removedWith(Changed) removed!: string;
    @removedWithJoin(Changed) removedJoin!: string;
    @setFromContext(Changed) contextValue!: string;
    @setFrom(Changed) set!: string;
    @setValue(Changed, 'fixed') constant!: string;
    @subtractFrom(Changed) subtracted!: number;
    @jsonSchemaProperty() tracked!: string;
}

class StandardMappedOnly {
    @setFrom(Changed) value = '';
}

class UnconstructedMappedOnly {
    @setFrom(Changed) value = '';
}

describe('standard model-bound decorators', () => {
    it('should register a standard-mapped class when constructed without file discovery', () => {
        new StandardMappedOnly();
        new StandardMappedOnly();
        expect(TypeDiscoverer.default.getTypeByDecoratorTypeAndName(DecoratorType.ReadModel, 'StandardMappedOnly'))
            .toBe(StandardMappedOnly);
        expect(DefaultClientArtifactsProvider.default.readModels.filter(type => type === StandardMappedOnly)).toHaveLength(1);
    });

    it('should explain that an unconstructed property-only model was never registered', async () => {
        const getInstanceByKey = vi.fn().mockResolvedValue({ ReadModel: '{"value":"stored"}' });
        const connection = { readModels: { getInstanceByKey } } as unknown as ChronicleConnection;
        const readModels = new ReadModels('store', 'Default', connection, DefaultClientArtifactsProvider.default, 'sink');
        await expect(readModels.findInstanceById(UnconstructedMappedOnly, 'id')).rejects.toThrow(/add a class-level @fromEvent/);
        expect(getInstanceByKey).not.toHaveBeenCalled();
    });
    it('stores class and property annotations without constructing an instance', () => {
        const target = Mappings.prototype;
        expect(isNoAutoMap(Mappings)).toBe(true);
        expect(isPropertyNoAutoMap(target, 'excluded')).toBe(true);
        expect(isNested(target, 'nestedValue')).toBe(true);
        expect(getAddFromMetadata(target, 'added')).toHaveLength(1);
        expect(getChildrenFromMetadata(target, 'children')).toHaveLength(1);
        expect(getClearWithPropertyMetadata(target, 'cleared')).toHaveLength(1);
        expect(getCountMetadata(target, 'counted')).toHaveLength(1);
        expect(getDecrementMetadata(target, 'decremented')).toHaveLength(1);
        expect(getFromAllMetadata(target, 'all')).toEqual({ property: undefined, contextProperty: undefined });
        expect(getFromEveryMetadata(target, 'every')).toEqual({ property: undefined, contextProperty: undefined });
        expect(getIncrementMetadata(target, 'incremented')).toHaveLength(1);
        expect(getJoinMetadata(target, 'joined')).toHaveLength(1);
        expect(getRemovedWithPropertyMetadata(target, 'removed')).toHaveLength(1);
        expect(getRemovedWithJoinPropertyMetadata(target, 'removedJoin')).toHaveLength(1);
        expect(getSetFromContextMetadata(target, 'contextValue')).toHaveLength(1);
        expect(getSetFromMetadata(target, 'set')).toHaveLength(1);
        expect(getSetValueMetadata(target, 'constant')).toEqual([{ eventType: Changed, value: 'fixed' }]);
        expect(getSubtractFromMetadata(target, 'subtracted')).toHaveLength(1);
        expect(getTrackedJsonSchemaProperties(Mappings)).toContain('tracked');
    });
});
