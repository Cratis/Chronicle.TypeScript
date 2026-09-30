// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync, writeFileSync } from 'node:fs';
import { field, Constructor } from '@cratis/fundamentals';
import { chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { IProjectionBuilderFor } from './declarative/IProjectionBuilderFor.js';
import { IProjectionFor } from './declarative/IProjectionFor.js';
import { projection } from './declarative/projection.js';
import { addFrom } from './modelBound/addFrom.js';
import { childrenFrom } from './modelBound/childrenFrom.js';
import { clearWith } from './modelBound/clearWith.js';
import { count } from './modelBound/count.js';
import { decrement } from './modelBound/decrement.js';
import { entersOn } from './modelBound/entersOn.js';
import { eventSequence } from './modelBound/eventSequence.js';
import { fromAll } from './modelBound/fromAll.js';
import { fromEvent } from './modelBound/fromEvent.js';
import { fromEvery } from './modelBound/fromEvery.js';
import { globalFor } from './modelBound/globalFor.js';
import { increment } from './modelBound/increment.js';
import { isModelBoundProjection } from './modelBound/isModelBoundProjection.js';
import { join } from './modelBound/join.js';
import { nested } from './modelBound/nested.js';
import { noAutoMap } from './modelBound/noAutoMap.js';
import { notRewindable } from './modelBound/notRewindable.js';
import { passive } from './modelBound/passive.js';
import { removedWith } from './modelBound/removedWith.js';
import { removedWithJoin } from './modelBound/removedWithJoin.js';
import { setFrom } from './modelBound/setFrom.js';
import { setFromContext } from './modelBound/setFromContext.js';
import { setValue } from './modelBound/setValue.js';
import { subtractFrom } from './modelBound/subtractFrom.js';
import { variantOf } from './modelBound/variantOf.js';
import { ProjectionDefinitionCompiler } from './ProjectionDefinitionCompiler.js';
import { Projections } from './Projections.js';

class ItemCreated { name!: string; quantity!: number; }
eventType()(ItemCreated);
class ItemUpdated { name!: string; quantity!: number; }
eventType()(ItemUpdated);
class ItemRemoved {}
eventType()(ItemRemoved);
class DescriptionCleared {}
eventType()(DescriptionCleared);
class LineAdded { productId!: string; }
eventType()(LineAdded);
class Joined { name!: string; }
eventType()(Joined);
class Opened { title!: string; }
eventType()(Opened);
class Published { url!: string; }
eventType()(Published);
class TitleChanged { title!: string; }
eventType()(TitleChanged);

class Flat { id!: string; name!: string; }
setFrom(ItemCreated, 'name')(Flat.prototype, 'name');
fromEvent(ItemCreated)(Flat);
class AutoMapped { id!: string; name!: string; quantity!: number; }
noAutoMap(AutoMapped.prototype, 'quantity');
fromEvent(ItemCreated)(AutoMapped);
class Totals { id!: string; quantity!: number; removed!: number; count!: number; }
addFrom(ItemCreated, 'quantity')(Totals.prototype, 'quantity');
subtractFrom(ItemUpdated, 'quantity')(Totals.prototype, 'removed');
count(ItemCreated)(Totals.prototype, 'count');
fromEvent(ItemCreated)(Totals);
class Removable { id!: string; name!: string; }
fromEvent(ItemCreated)(Removable);
removedWith(ItemRemoved)(Removable);
class Line { productId!: string; }
class WithChildren { id!: string; lines!: Line[]; }
childrenFrom(LineAdded, undefined, 'productId')(WithChildren.prototype, 'lines');
field(Array, { enumerable: true, genericArguments: [Line] })(WithChildren.prototype, 'lines');
fromEvent(ItemCreated)(WithChildren);
class WithJoin { id!: string; name!: string; }
join(Joined, 'name')(WithJoin.prototype, 'name');
fromEvent(ItemCreated)(WithJoin);
class Every { id!: string; name!: string; }
fromEvery('name')(Every.prototype, 'name');
fromEvent(ItemCreated)(Every);

class PassiveModel { id!: string; name!: string; }
field(String)(PassiveModel.prototype, 'name');
setFrom(ItemCreated, 'name')(PassiveModel.prototype, 'name');
fromEvent(ItemCreated)(PassiveModel);
passive(PassiveModel);

class Detail { description!: string; }
setFrom(ItemCreated, 'name')(Detail.prototype, 'description');
clearWith(DescriptionCleared)(Detail.prototype, 'description');
fromEvent(ItemCreated)(Detail);
clearWith(ItemRemoved)(Detail);
class WithNested { id!: string; detail!: Detail; title!: string; }
field(Detail)(WithNested.prototype, 'detail');
nested(WithNested.prototype, 'detail');
clearWith(ItemUpdated)(WithNested.prototype, 'detail');
clearWith(ItemRemoved)(WithNested.prototype, 'title');
fromEvent(ItemCreated)(WithNested);

class WithRemovedJoin { id!: string; name!: string; }
removedWithJoin(ItemRemoved, 'productId')(WithRemovedJoin);
removedWithJoin(TitleChanged, 'title')(WithRemovedJoin.prototype, 'name');
fromEvent(ItemCreated)(WithRemovedJoin);

class CustomKeys { id!: string; }
fromEvent(ItemCreated, { key: 'productId', parentKey: 'ownerId' })(CustomKeys);
class ConstantKeys { id!: string; }
fromEvent(ItemCreated, { constantKey: 'one', parentKey: 'ownerId' })(ConstantKeys);

class NoMapping { id!: string; name!: string; }
noAutoMap(NoMapping);
fromEvent(ItemCreated)(NoMapping);
class NoRewind { id!: string; }
notRewindable(NoRewind);
fromEvent(ItemCreated)(NoRewind);
class OtherSequence { id!: string; }
eventSequence('custom-sequence')(OtherSequence);
fromEvent(ItemCreated)(OtherSequence);

class MappingOptions { id!: string; context!: string; state!: string; increments!: number; decrements!: number; all!: string; }
field(String)(MappingOptions.prototype, 'context');
field(Number)(MappingOptions.prototype, 'increments');
setFromContext(ItemCreated, 'eventSourceId')(MappingOptions.prototype, 'context');
setValue(ItemUpdated, 'ready')(MappingOptions.prototype, 'state');
increment(ItemCreated)(MappingOptions.prototype, 'increments');
decrement(ItemUpdated)(MappingOptions.prototype, 'decrements');
fromAll('name')(MappingOptions.prototype, 'all');
fromEvent(ItemCreated)(MappingOptions);

class Identity {}
class Draft { id!: string; title!: string; }
setFrom(Opened, 'title')(Draft.prototype, 'title');
variantOf(Identity, 'id')(Draft);
entersOn(Opened)(Draft);
fromEvent(Opened)(Draft);
class Public { id!: string; url!: string; title!: string; }
setFrom(Published, 'url')(Public.prototype, 'url');
setFrom(TitleChanged, 'title')(Public.prototype, 'title');
variantOf(Identity, 'id')(Public);
entersOn(Published)(Public);
fromEvent(Published)(Public);
fromEvent(TitleChanged)(Public);
class KeyedVariant { id!: string; title!: string; }
variantOf(Identity, 'id')(KeyedVariant);
entersOn(Opened, 'productId')(KeyedVariant);
fromEvent(Opened)(KeyedVariant);
class SharedTitle { title!: string; }
setFrom(TitleChanged, 'title')(SharedTitle.prototype, 'title');
globalFor(Identity)(SharedTitle);

class Declarative { id!: string; name!: string; quantity!: number; lines!: Line[]; contextLines!: Line[]; }
class DeclarativeProjection implements IProjectionFor<Declarative> {
    define(builder: IProjectionBuilderFor<Declarative>): void {
        builder.from(ItemCreated, from => from.set(model => model.name).to(event => event.name)
            .addChild<Line>(model => model.contextLines, child => child.identifiedBy(line => line.productId)
                .usingKeyFromContext('sequenceNumber').usingParentKeyFromContext('eventSourceId')))
            .join(Joined, joined => joined.on(model => model.name).set(model => model.name).to(event => event.name))
            .fromEvery(every => every.set(model => model.name).toEventContextProperty('eventType'))
            .removedWith(ItemRemoved)
            .children<Line>(model => model.lines, children => children.from(LineAdded))
            .autoMap();
    }
}
projection('Declarative', Declarative)(DeclarativeProjection);
class AnotherDeclarativeProjection implements IProjectionFor<Declarative> {
    define(builder: IProjectionBuilderFor<Declarative>): void {
        builder.from(ItemUpdated);
    }
}
projection('AnotherDeclarative', Declarative)(AnotherDeclarativeProjection);

class DeclarativeDraft { id!: string; title!: string; }
class DeclarativeDraftProjection implements IProjectionFor<DeclarativeDraft> {
    define(builder: IProjectionBuilderFor<DeclarativeDraft>): void {
        builder.variantOf(Identity, model => model.id).entersOn(Opened).from(Opened);
    }
}
projection('DeclarativeDraft', DeclarativeDraft)(DeclarativeDraftProjection);
class DeclarativePublic { id!: string; url!: string; }
class DeclarativePublicProjection implements IProjectionFor<DeclarativePublic> {
    define(builder: IProjectionBuilderFor<DeclarativePublic>): void {
        builder.variantOf(Identity, model => model.id).entersOn(Published).from(Published).from(TitleChanged);
    }
}
projection('DeclarativePublic', DeclarativePublic)(DeclarativePublicProjection);

class Inferred { uniqueTitle!: string; }
field(String)(Inferred.prototype, 'uniqueTitle');
class InferredProjection implements IProjectionFor<Inferred> {
    define(builder: IProjectionBuilderFor<Inferred>): void {
        builder.from(Opened, from => from.set(model => model.uniqueTitle).to(event => event.title));
    }
}
projection()(InferredProjection);

const cases = [
    { name: 'flat', readModels: [Flat], projections: [], globalForHandlers: [] },
    { name: 'passive-with-fields', readModels: [PassiveModel], projections: [], globalForHandlers: [] },
    { name: 'nested-and-clear', readModels: [WithNested], projections: [], globalForHandlers: [] },
    { name: 'removed-with-join', readModels: [WithRemovedJoin], projections: [], globalForHandlers: [] },
    { name: 'custom-keys', readModels: [CustomKeys, ConstantKeys], projections: [], globalForHandlers: [] },
    { name: 'no-auto-map', readModels: [NoMapping], projections: [], globalForHandlers: [] },
    { name: 'not-rewindable', readModels: [NoRewind], projections: [], globalForHandlers: [] },
    { name: 'event-sequence', readModels: [OtherSequence], projections: [], globalForHandlers: [] },
    { name: 'mapping-options-with-fields', readModels: [MappingOptions], projections: [], globalForHandlers: [] },
    { name: 'enters-on-key', readModels: [KeyedVariant], projections: [], globalForHandlers: [] },
    { name: 'declarative-inferred-with-fields', readModels: [Inferred], projections: [InferredProjection], globalForHandlers: [] },
    { name: 'automap-exclusion', readModels: [AutoMapped], projections: [], globalForHandlers: [] },
    { name: 'arithmetic', readModels: [Totals], projections: [], globalForHandlers: [] },
    { name: 'removed-with', readModels: [Removable], projections: [], globalForHandlers: [] },
    { name: 'children', readModels: [WithChildren], projections: [], globalForHandlers: [] },
    { name: 'join', readModels: [WithJoin], projections: [], globalForHandlers: [] },
    { name: 'from-every', readModels: [Every], projections: [], globalForHandlers: [] },
    { name: 'model-bound-variants', readModels: [Draft, Public], projections: [], globalForHandlers: [SharedTitle] },
    { name: 'declarative', readModels: [Declarative], projections: [DeclarativeProjection], globalForHandlers: [] },
    { name: 'declarative-variants', readModels: [DeclarativeDraft, DeclarativePublic], projections: [DeclarativeDraftProjection, DeclarativePublicProjection], globalForHandlers: [] }
];

function artifactsFor(testCase: typeof cases[number]): IClientArtifactsProvider {
    return {
        projections: testCase.projections as Constructor[],
        readModels: testCase.readModels as Constructor[],
        globalForHandlers: testCase.globalForHandlers as Constructor[],
        eventTypes: [ItemCreated, ItemUpdated, ItemRemoved, LineAdded, Joined, Opened, Published, TitleChanged],
        reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
}

function serializeContract(value: unknown): string {
    return JSON.stringify(value, (_key, member: unknown) => typeof member === 'bigint' ? member.toString() : member);
}

async function captureRegistration(artifacts: IClientArtifactsProvider): Promise<string> {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const registerManyMock = vi.fn().mockResolvedValue(undefined);
    const connection = {
        projections: { register: registerMock },
        readModels: { registerMany: registerManyMock }
    } as unknown as ChronicleConnection;
    await new Projections('test-store', 'test-namespace', connection, artifacts, 'test-sink').register();
    return serializeContract({
        readModels: registerManyMock.mock.calls.map(call => call[0].ReadModels).flat(),
        projections: registerMock.mock.calls.map(call => call[0].Projections).flat()
    });
}

chai.should();

const goldenUrl = new URL('./ProjectionDefinitionCompiler.registration.golden.json', import.meta.url);

describe('projection registration payload', () => {
    if (process.env.UPDATE_PROJECTION_GOLDEN === '1') {
        it('regenerates the golden from registration payloads', async () => {
            const goldens = JSON.parse(readFileSync(goldenUrl, 'utf8')) as Array<{ name: string; payload: string }>;
            for (const golden of goldens) {
                const testCase = cases.find(candidate => candidate.name === golden.name);
                if (!testCase) throw new Error(`No registration case for golden '${golden.name}'.`);
                golden.payload = await captureRegistration(artifactsFor(testCase));
            }
            if (goldens.length !== cases.length) throw new Error('Registration golden and cases have different lengths.');
            writeFileSync(goldenUrl, `${JSON.stringify(goldens, null, 2)}\n`);
        });
    }

    for (const testCase of cases) {
        it(`should match the registration golden for ${testCase.name}`, async () => {
            const actual = await captureRegistration(artifactsFor(testCase));
            const goldens = JSON.parse(readFileSync(goldenUrl, 'utf8')) as Array<{ name: string; payload: string }>;
            actual.should.equal(goldens.find(candidate => candidate.name === testCase.name)?.payload);
        });

        it(`should send the compiler's definitions and read-model schemas for ${testCase.name}`, async () => {
            const artifacts = artifactsFor(testCase);
            const compiled = new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile(
                artifacts.projections,
                artifacts.readModels.filter(isModelBoundProjection)
            );
            const compiledPayload = serializeContract({ readModels: compiled.readModels, projections: compiled.definitions });
            compiledPayload.should.equal(await captureRegistration(artifacts));
        });
    }

    it('should hash nested model-bound mappings after compiling the final definition', () => {
        const hashFor = (propertyExpression: string): string => {
            class HashedProjection { id!: string; name!: string; }
            setFrom(ItemCreated, propertyExpression)(HashedProjection.prototype, 'name');
            fromEvent(ItemCreated)(HashedProjection);
            const artifacts = artifactsFor(cases[0]);
            artifacts.readModels = [HashedProjection];
            const definition = new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile([], [HashedProjection]).definitions[0];
            return definition.LastUpdated.Value;
        };

        hashFor('name').should.not.equal(hashFor('quantity'));
        hashFor('name').should.equal(hashFor('name'));
    });

    it('should reject multiple projections for one read model', () => {
        const artifacts = artifactsFor(cases.find(testCase => testCase.name === 'declarative')!);
        (() => new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile(
            [DeclarativeProjection, AnotherDeclarativeProjection], []
        )).should.throw("Read model id 'Declarative' has multiple projections.");
    });
});
