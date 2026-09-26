// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
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
import { count } from './modelBound/count.js';
import { entersOn } from './modelBound/entersOn.js';
import { fromEvent } from './modelBound/fromEvent.js';
import { fromEvery } from './modelBound/fromEvery.js';
import { globalFor } from './modelBound/globalFor.js';
import { join } from './modelBound/join.js';
import { noAutoMap } from './modelBound/noAutoMap.js';
import { removedWith } from './modelBound/removedWith.js';
import { setFrom } from './modelBound/setFrom.js';
import { subtractFrom } from './modelBound/subtractFrom.js';
import { variantOf } from './modelBound/variantOf.js';
import { Projections } from './Projections.js';

class ItemCreated { name!: string; quantity!: number; }
eventType()(ItemCreated);
class ItemUpdated { name!: string; quantity!: number; }
eventType()(ItemUpdated);
class ItemRemoved {}
eventType()(ItemRemoved);
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
class SharedTitle { title!: string; }
setFrom(TitleChanged, 'title')(SharedTitle.prototype, 'title');
globalFor(Identity)(SharedTitle);

class Declarative { id!: string; name!: string; quantity!: number; lines!: Line[]; }
class DeclarativeProjection implements IProjectionFor<Declarative> {
    define(builder: IProjectionBuilderFor<Declarative>): void {
        builder.from(ItemCreated, from => from.set(model => model.name).to(event => event.name))
            .join(Joined, joined => joined.on(model => model.name).set(model => model.name).to(event => event.name))
            .fromEvery(every => every.set(model => model.name).toEventContextProperty('eventType'))
            .removedWith(ItemRemoved)
            .children<Line>(model => model.lines, children => children.from(LineAdded))
            .autoMap();
    }
}
projection('Declarative', Declarative)(DeclarativeProjection);

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

const cases = [
    { name: 'flat', readModels: [Flat], projections: [], globalForHandlers: [] },
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

async function captureRegistration(testCase: typeof cases[number]): Promise<string> {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const registerManyMock = vi.fn().mockResolvedValue(undefined);
    const connection = {
        projections: { register: registerMock },
        readModels: { registerMany: registerManyMock }
    } as unknown as ChronicleConnection;
    const artifacts: IClientArtifactsProvider = {
        projections: testCase.projections as Constructor[],
        readModels: testCase.readModels as Constructor[],
        globalForHandlers: testCase.globalForHandlers as Constructor[],
        eventTypes: [ItemCreated, ItemUpdated, ItemRemoved, LineAdded, Joined, Opened, Published, TitleChanged],
        reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    await new Projections('test-store', 'test-namespace', connection, artifacts, 'test-sink').register();
    return JSON.stringify({
        readModels: registerManyMock.mock.calls.map(call => call[0].ReadModels).flat(),
        projections: registerMock.mock.calls.map(call => call[0].Projections).flat()
    }, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
}

chai.should();

const goldenUrl = new URL('./ProjectionDefinitionCompiler.registration.golden.json', import.meta.url);

describe('projection registration payload', () => {
    for (const testCase of cases) {
        it(`should preserve origin/main for ${testCase.name}`, async () => {
            const actual = await captureRegistration(testCase);
            const goldens = JSON.parse(readFileSync(goldenUrl, 'utf8')) as Array<{ name: string; payload: string }>;
            actual.should.equal(goldens.find(candidate => candidate.name === testCase.name)?.payload);
        });
    }
});
