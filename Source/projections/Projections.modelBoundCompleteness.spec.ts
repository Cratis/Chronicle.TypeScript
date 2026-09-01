// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { AutoMap } from '@cratis/chronicle.contracts';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { eventType } from '../events/eventTypeDecorator';
import { readModel } from '../readModels/readModel';
import { clearWith } from './modelBound/clearWith';
import { eventLog, eventSequence } from './modelBound/eventSequence';
import { fromAll } from './modelBound/fromAll';
import { fromEvent } from './modelBound/fromEvent';
import { noAutoMap } from './modelBound/noAutoMap';
import { setFrom } from './modelBound/setFrom';
import { Projections } from './Projections';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class MbWorkArrangementSet {
    location!: string;
    workMode!: number;
}
eventType()(MbWorkArrangementSet);

class MbCandidateSubmitted {
    name!: string;
    location!: string;
}
eventType()(MbCandidateSubmitted);

class MbAssignmentSummary {
    id!: string;
    location!: string;
    candidateName!: string;
}
setFrom(MbWorkArrangementSet, 'location')(MbAssignmentSummary.prototype, 'location');
noAutoMap(MbAssignmentSummary.prototype, 'location');
setFrom(MbCandidateSubmitted, 'name')(MbAssignmentSummary.prototype, 'candidateName');
fromEvent(MbWorkArrangementSet)(MbAssignmentSummary);
readModel()(MbAssignmentSummary);

class MbFullyExcluded {
    id!: string;
    location!: string;
}
setFrom(MbWorkArrangementSet, 'location')(MbFullyExcluded.prototype, 'location');
fromEvent(MbWorkArrangementSet)(MbFullyExcluded);
noAutoMap(MbFullyExcluded);
readModel()(MbFullyExcluded);

class MbProductRenamed {
    name!: string;
    version!: number;
}
eventType()(MbProductRenamed);

class MbProductPriceChanged {
    price!: number;
    version!: number;
}
eventType()(MbProductPriceChanged);

class MbProductVersion {
    id!: string;
    name!: string;
    price!: number;
    version!: number;
}
fromAll('version')(MbProductVersion.prototype, 'version');
fromEvent(MbProductRenamed)(MbProductVersion);
fromEvent(MbProductPriceChanged)(MbProductVersion);
readModel()(MbProductVersion);

class MbOrderPlaced {
    amount!: number;
}
eventType()(MbOrderPlaced);

class MbOrderSummaryWithCustomSequence {
    id!: string;
    totalAmount!: number;
}
setFrom(MbOrderPlaced, 'amount')(MbOrderSummaryWithCustomSequence.prototype, 'totalAmount');
fromEvent(MbOrderPlaced)(MbOrderSummaryWithCustomSequence);
eventSequence('custom-sequence')(MbOrderSummaryWithCustomSequence);
readModel()(MbOrderSummaryWithCustomSequence);

class MbLocalEvent {
    data!: string;
}
eventType()(MbLocalEvent);

class MbLocalSnapshot {
    id!: string;
    data!: string;
}
setFrom(MbLocalEvent, 'data')(MbLocalSnapshot.prototype, 'data');
fromEvent(MbLocalEvent)(MbLocalSnapshot);
eventLog(MbLocalSnapshot);
readModel()(MbLocalSnapshot);

class MbProjectNoted {
    note!: string;
}
eventType()(MbProjectNoted);

class MbProjectNoteCleared {}
eventType()(MbProjectNoteCleared);

class MbProjectNotes {
    id!: string;
    note!: string | undefined;
}
setFrom(MbProjectNoted, 'note')(MbProjectNotes.prototype, 'note');
clearWith(MbProjectNoteCleared)(MbProjectNotes.prototype, 'note');
fromEvent(MbProjectNoted)(MbProjectNotes);
readModel()(MbProjectNotes);

interface BuiltFromEntry {
    Key: { Id: string };
    Value: { Properties: Record<string, string>; Key: string; ParentKey: string };
}

interface BuiltDefinition {
    EventSequenceId: string;
    AutoMap: AutoMap;
    NoAutoMapProperties: string[];
    All: { Properties: Record<string, string> };
    From: BuiltFromEntry[];
}

function createProjections(readModels: (new (...args: unknown[]) => unknown)[]) {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const registerManyMock = vi.fn().mockResolvedValue(undefined);
    const connection = {
        readModels: { registerMany: registerManyMock },
        projections: { register: registerMock }
    } as unknown as ChronicleConnection;

    const clientArtifacts: IClientArtifactsProvider = {
        eventTypes: [],
        readModels: readModels as unknown as IClientArtifactsProvider['readModels'],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: [],
        webhooks: [],
        eventTypeMigrations: []
    };

    const projections = new Projections('test-store', 'test-namespace', connection, clientArtifacts, 'test-sink');
    return { projections, registerMock };
}

async function registerAndGetDefinition(readModelType: new (...args: unknown[]) => unknown): Promise<BuiltDefinition> {
    const { projections, registerMock } = createProjections([readModelType]);
    await projections.register();
    return registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
}

function findFromEntry(definition: BuiltDefinition, eventTypeId: string): BuiltFromEntry {
    const entry = definition.From.find(candidate => candidate.Key.Id === eventTypeId);
    if (!entry) {
        throw new Error(`No From entry found for event type '${eventTypeId}'.`);
    }
    return entry;
}

describe('Projections model-bound completeness', () => {
    describe('when a property is excluded from AutoMap with noAutoMap', () => {
        it('should keep AutoMap enabled at the root and list only the excluded property', async () => {
            const definition = await registerAndGetDefinition(MbAssignmentSummary);

            expect(definition.AutoMap).toBe(AutoMap.Enabled);
            expect(definition.NoAutoMapProperties).toEqual(['location']);

            const workArrangementSet = findFromEntry(definition, 'MbWorkArrangementSet');
            expect(workArrangementSet.Value.Properties.location).toBe('location');

            const candidateSubmitted = findFromEntry(definition, 'MbCandidateSubmitted');
            expect(candidateSubmitted.Value.Properties.candidateName).toBe('name');
        });
    });

    describe('when a whole model-bound projection is excluded from AutoMap with class-level noAutoMap', () => {
        it('should disable AutoMap for the whole definition', async () => {
            const definition = await registerAndGetDefinition(MbFullyExcluded);
            expect(definition.AutoMap).toBe(AutoMap.Disabled);
        });
    });

    describe('when a property uses fromAll to read from every event type', () => {
        it('should include it in the All properties map', async () => {
            const definition = await registerAndGetDefinition(MbProductVersion);
            expect(definition.All.Properties.version).toBe('version');
        });
    });

    describe('when a model-bound projection declares a custom event sequence', () => {
        it('should use the declared event sequence instead of the event log', async () => {
            const definition = await registerAndGetDefinition(MbOrderSummaryWithCustomSequence);
            expect(definition.EventSequenceId).toBe('custom-sequence');
        });
    });

    describe('when a model-bound projection is explicitly pinned to the event log', () => {
        it('should use the event log sequence', async () => {
            const definition = await registerAndGetDefinition(MbLocalSnapshot);
            expect(definition.EventSequenceId).toBe('event-log');
        });
    });

    describe('when a root scalar property is cleared with an event', () => {
        it('should add a $null mapping for that property on the clearing event', async () => {
            const definition = await registerAndGetDefinition(MbProjectNotes);
            const clearedBy = findFromEntry(definition, 'MbProjectNoteCleared');
            expect(clearedBy.Value.Properties.note).toBe('$null');
        });
    });
});
