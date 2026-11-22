// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { ProjectionDefinitionCompiler } from '../../ProjectionDefinitionCompiler.js';
import { childrenFrom } from '../childrenFrom.js';
import { fromEvent } from '../fromEvent.js';
import { setFrom } from '../setFrom.js';
import { artifacts, ChildKey, ItemChanged, ReorderedItemChanged, Opened, keyExpression } from './given/compiled_projection.js';
import { assertCompositeDefinition, assertOracleInputAndCreation, assertRegisteredDefinition, assertScenarioRemainsRejected } from './given/assertions.js';

chai.should();
class Item {
    @field(ChildKey) id!: ChildKey;
    @field(String) @setFrom(ItemChanged, 'name') @setFrom(ReorderedItemChanged, 'name') name!: string;
}
@fromEvent(Opened)
class Parent {
    @field(String) id!: string;
    @field(String) caption!: string;
    @field(Array)
    @childrenFrom(ItemChanged, { childType: Item, identifiedBy: 'id', key: keyExpression() })
    @childrenFrom(ReorderedItemChanged, { childType: Item, identifiedBy: 'id', key: keyExpression(true) }) items!: Item[];
}
class SingleItem {
    @field(String) id!: string;
    @field(String) name!: string;
}
@fromEvent(Opened)
class SingleParent {
    @field(String) id!: string;
    @field(Array) @childrenFrom(ItemChanged, { childType: SingleItem, identifiedBy: 'id', key: 'left' }) items!: SingleItem[];
}
const modelArtifacts = { ...artifacts, projections: [], readModels: [Parent] };
export const candidate = {
    name: 'composite-child-creation-legacy', model: Parent, artifacts: modelArtifacts,
    compile: () => new ProjectionDefinitionCompiler(modelArtifacts, 'test').compile([], [Parent])
};
describe('when compiling composite child keys through legacy decorators', () => {
    it('should preserve Key, IdentifiedBy and explicit mappings without synthesizing an identifier mapper', () => assertCompositeDefinition(candidate, { name: 'name' }));
    it('should register the same corrected definition through the production registration path', () => assertRegisteredDefinition(candidate));
    it('should match the compiler-derived kernel creation and update fixture', () => assertOracleInputAndCreation(candidate));
    it('should keep composite child keys rejected by ReadModelScenario', () => assertScenarioRemainsRejected(candidate));
    it('should retain the identifier mapping for a single-property child key', () => {
        const compiled = new ProjectionDefinitionCompiler({ ...modelArtifacts, readModels: [SingleParent] }, 'test').compile([], [SingleParent]);
        const child = compiled.definitions[0].Children.items;
        child.IdentifiedBy.should.equal('id');
        child.From[0].Value!.Key.should.equal('left');
        child.From[0].Value!.Properties.should.deep.equal({ id: 'left' });
    });
});
