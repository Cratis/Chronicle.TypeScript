// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ConceptAs, field, Guid, type Constructor } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { subject } from '../compliance/subject.js';
import { pii } from '../compliance/pii.js';
import { reducer } from '../reducers/reducer.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
import { ReadModels } from './ReadModels.js';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class SomeEvent {
    value = '';
}

function createReadModels(readModelType: Constructor, releaseResponse: Record<string, unknown> = { HasError: false, Payload: '{}' }) {
    const release = vi.fn().mockResolvedValue(releaseResponse);
    const getInstanceByKey = vi.fn().mockResolvedValue({ ReadModel: '' });
    const connection = {
        compliance: { release },
        readModels: { getInstanceByKey }
    } as unknown as ChronicleConnection;

    const clientArtifacts = {
        eventTypes: [],
        readModels: [readModelType],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: [],
        webhooks: [],
        eventTypeMigrations: [],
        globalForHandlers: []
    } as IClientArtifactsProvider;

    const readModels = new ReadModels('test-store', 'test-namespace', connection, clientArtifacts, 'default-sink');
    return { readModels, release, getInstanceByKey };
}

describe('ReadModels', () => {
    describe('when no read model instance exists for a key', () => {
        class MissingModel { id = ''; }
        fromEvent(SomeEvent)(MissingModel);

        it('should retain the legacy prototype-only instance for getInstanceById', async () => {
            const { readModels, release } = createReadModels(MissingModel);
            const instance = await readModels.getInstanceById(MissingModel, 'missing');
            expect(instance).toBeInstanceOf(MissingModel);
            expect(Object.keys(instance)).toEqual([]);
            expect(release).not.toHaveBeenCalled();
        });

        it('should return null from findInstanceById without releasing PII', async () => {
            const { readModels, release, getInstanceByKey } = createReadModels(MissingModel);
            const instance = await readModels.findInstanceById(MissingModel, 'missing', 'session-1');
            expect(instance).toBeNull();
            expect(getInstanceByKey).toHaveBeenCalledWith(expect.objectContaining({ ReadModelKey: 'missing', SessionId: 'session-1' }));
            expect(release).not.toHaveBeenCalled();
        });

        it('should return null when the kernel responds with literal JSON null', async () => {
            const { readModels, getInstanceByKey, release } = createReadModels(MissingModel);
            getInstanceByKey.mockResolvedValue({ ReadModel: 'null' });
            const instance = await readModels.findInstanceById(MissingModel, 'missing');
            expect(instance).toBeNull();
            expect(release).not.toHaveBeenCalled();
        });
    });

    describe('when a read model instance exists for a key', () => {
        class ExistingModel { id = ''; }
        field(String)(ExistingModel.prototype, 'id');
        fromEvent(SomeEvent)(ExistingModel);

        it('should deserialize the model', async () => {
            const { readModels, getInstanceByKey } = createReadModels(ExistingModel);
            getInstanceByKey.mockResolvedValue({ ReadModel: '{"id":"found"}' });
            const instance = await readModels.findInstanceById(ExistingModel, 'found');
            expect(instance).toBeInstanceOf(ExistingModel);
            expect(instance?.id).toBe('found');
            const legacyInstance = await readModels.getInstanceById(ExistingModel, 'found');
            expect(legacyInstance).toBeInstanceOf(ExistingModel);
            expect(legacyInstance.id).toBe('found');
        });
    });

    describe('when reading a model with undecorated and model-bound members', () => {
        class Code extends ConceptAs<string> {}
        class MappedModel {
            id = '';
            name = '';
            count = 0;
            active = false;
            occurred = new Date(0);
            mapped = '';
            code = new Code('initial');
            guid = Guid.empty;
            typed = Guid.empty;
        }
        field(Guid)(MappedModel.prototype, 'typed');
        setFrom(SomeEvent, 'value')(MappedModel.prototype, 'mapped');
        fromEvent(SomeEvent)(MappedModel);
        const json = JSON.stringify({ id: 'a', name: 'stored', count: 42, active: true,
            occurred: '2024-01-02T00:00:00.000Z', mapped: 'from event', code: 'stored-code',
            guid: 'e951d9a0-720f-4e37-835f-701707f7b678',
            typed: 'e951d9a0-720f-4e37-835f-701707f7b678', __internal: 'ignored' });

        it('should restore all declared members for single and multiple reads', async () => {
            const { readModels, getInstanceByKey } = createReadModels(MappedModel);
            getInstanceByKey.mockResolvedValue({ ReadModel: json });
            const getAllInstances = vi.fn().mockResolvedValue({ Instances: [json] });
            const connection = { readModels: { getAllInstances } } as unknown as ChronicleConnection;
            const provider = { readModels: [MappedModel], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
            const all = await new ReadModels('store', 'tenant', connection, provider, 'sink').getInstances(MappedModel);
            for (const instance of [await readModels.findInstanceById(MappedModel, 'a'),
                await readModels.getInstanceById(MappedModel, 'a'), ...all]) {
                expect(instance).toMatchObject({ id: 'a', name: 'stored', count: 42, active: true, mapped: 'from event' });
                expect(instance?.occurred).toEqual(new Date('2024-01-02T00:00:00.000Z'));
                expect(instance?.code).toBeInstanceOf(Code);
                expect(instance?.code.value).toBe('stored-code');
                expect(instance?.guid).toBeInstanceOf(Guid);
                expect(instance?.typed).toBeInstanceOf(Guid);
                expect(Object.hasOwn(instance as object, '__internal')).toBe(false);
            }
        });

        it('should restore snapshot and watched instances', async () => {
            const connection = { readModelExplorer: { allSnapshotsForReadModel: vi.fn().mockResolvedValue({ Data: [{ Instance: json }] }) },
                readModels: { watch: async function* () {
                    yield { Namespace: 'tenant', ModelKey: 'a', ReadModel: json, Removed: false };
                } } } as unknown as ChronicleConnection;
            const provider = { readModels: [MappedModel], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
            const readModels = new ReadModels('store', 'tenant', connection, provider, 'sink');
            const snapshots = await readModels.getSnapshotsById(MappedModel, 'a');
            const watched = await readModels.watch(MappedModel)[Symbol.asyncIterator]().next();
            expect(snapshots[0].readModel.mapped).toBe('from event');
            expect(snapshots[0].readModel.occurred).toBeInstanceOf(Date);
            expect(watched.value?.readModel.name).toBe('stored');
            expect(watched.value?.readModel.occurred).toBeInstanceOf(Date);
        });
    });

    describe('when reading a compliance-bearing reducer', () => {
        class PrivateModel { id = ''; ssn = ''; }
        field(String)(PrivateModel.prototype, 'id');
        field(String)(PrivateModel.prototype, 'ssn');
        pii()(PrivateModel.prototype, 'ssn');
        class PrivateReducer {}
        reducer('PrivateInstanceReducer', undefined, PrivateModel)(PrivateReducer);

        it('should reject both read methods when compliance release fails', async () => {
            const release = vi.fn().mockResolvedValue({ HasError: true, Error: 'denied' });
            const getInstanceByKey = vi.fn().mockResolvedValue({ ReadModel: '{"id":"a","ssn":"ciphertext"}' });
            const connection = {
                readModels: { getInstanceByKey },
                compliance: { release }
            } as unknown as ChronicleConnection;
            const provider = { reducers: [PrivateReducer], projections: [], readModels: [] } as unknown as IClientArtifactsProvider;
            const readModels = new ReadModels('store', 'tenant', connection, provider, 'sink');

            await expect(readModels.getInstanceById(PrivateModel, 'a')).rejects.toThrow('Failed to release PII: denied');
            await expect(readModels.findInstanceById(PrivateModel, 'a')).rejects.toThrow('Failed to release PII: denied');
            expect(release).toHaveBeenCalledTimes(2);
        });
    });

    describe('when watching a projection', () => {
        class ProjectedModel { id = ''; }
        field(String)(ProjectedModel.prototype, 'id');
        fromEvent(SomeEvent)(ProjectedModel);

        it('should skip the subscription marker and yield changes and removals', async () => {
            const connection = {
                readModels: { watch: async function* () {
                    yield { Subscribed: true, Namespace: '', ModelKey: '', ReadModel: '', Removed: false };
                    yield { Subscribed: false, Namespace: 'tenant', ModelKey: 'a', ReadModel: '{"id":"a"}', Removed: false };
                    yield { Subscribed: false, Namespace: 'tenant', ModelKey: '', ReadModel: '{"id":"empty-key"}', Removed: false };
                    yield { Subscribed: false, Namespace: 'tenant', ModelKey: 'a', ReadModel: '', Removed: true };
                } }
            } as unknown as ChronicleConnection;
            const provider = { reducers: [], projections: [], readModels: [ProjectedModel] } as unknown as IClientArtifactsProvider;
            const readModels = new ReadModels('store', 'tenant', connection, provider, 'sink');
            const changesets = [];
            for await (const changeset of readModels.watch(ProjectedModel)) {
                changesets.push(changeset);
            }

            expect(changesets).toHaveLength(3);
            expect(changesets[0]).toMatchObject({ namespace: 'tenant', key: 'a', removed: false, readModel: { id: 'a' } });
            expect(changesets[1]).toMatchObject({ namespace: 'tenant', key: '', removed: false, readModel: { id: 'empty-key' } });
            expect(changesets[2]).toMatchObject({ namespace: 'tenant', key: 'a', removed: true });
        });
    });

    describe('when watching a compliance-bearing reducer', () => {
        class PrivateModel { id = ''; ssn = ''; }
        field(String)(PrivateModel.prototype, 'id');
        field(String)(PrivateModel.prototype, 'ssn');
        pii()(PrivateModel.prototype, 'ssn');
        class PrivateReducer {}
        reducer('PrivateReducer', undefined, PrivateModel)(PrivateReducer);

        it('should skip the subscription marker while releasing changes and retaining removals', async () => {
            const release = vi.fn().mockResolvedValue({ HasError: false, Payload: '{"id":"a","ssn":"cleartext"}' });
            const connection = {
                readModels: { watch: async function* () {
                    yield { Subscribed: true, Namespace: '', ModelKey: '', ReadModel: '', Removed: false };
                    yield { Subscribed: false, Namespace: 'tenant', ModelKey: 'a', ReadModel: '{"id":"a","ssn":"ciphertext"}', Removed: false };
                    yield { Subscribed: false, Namespace: 'tenant', ModelKey: 'a', ReadModel: '', Removed: true };
                } },
                compliance: { release }
            } as unknown as ChronicleConnection;
            const provider = { reducers: [PrivateReducer], projections: [], readModels: [] } as unknown as IClientArtifactsProvider;
            const readModels = new ReadModels('store', 'tenant', connection, provider, 'sink');
            const changesets = [];
            for await (const changeset of readModels.watch(PrivateModel)) {
                changesets.push(changeset);
            }

            expect(changesets).toHaveLength(2);
            expect(changesets[0]).toMatchObject({ namespace: 'tenant', key: 'a', removed: false, readModel: { id: 'a', ssn: 'cleartext' } });
            expect(changesets[1]).toMatchObject({ namespace: 'tenant', key: 'a', removed: true });
            expect(release).toHaveBeenCalledTimes(1);
        });

        it('should reject rather than expose an unreleased changeset', async () => {
            const release = vi.fn().mockResolvedValue({ HasError: true, Error: 'denied' });
            const connection = {
                readModels: { watch: async function* () {
                    yield { Namespace: 'tenant', ModelKey: 'a', ReadModel: '{"id":"a","ssn":"ciphertext"}', Removed: false };
                } },
                compliance: { release }
            } as unknown as ChronicleConnection;
            const provider = { reducers: [PrivateReducer], projections: [], readModels: [] } as unknown as IClientArtifactsProvider;
            const readModels = new ReadModels('store', 'tenant', connection, provider, 'sink');
            const iterator = readModels.watch(PrivateModel)[Symbol.asyncIterator]();
            await expect(iterator.next()).rejects.toThrow('Failed to release PII: denied');
        });
    });

    describe('when releasing a read model with a property decorated with @subject()', () => {
        class Employee {
            id = '';
            personId = '';
        }
        subject()(Employee.prototype, 'personId');
        fromEvent(SomeEvent)(Employee);

        it('should release using the decorated property as the subject', async () => {
            const { readModels, release } = createReadModels(Employee);
            const instance = new Employee();
            instance.id = 'employee-1';
            instance.personId = 'person-42';

            await readModels.release(Employee, instance);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'person-42' }));
        });
    });

    describe('when releasing a read model without @subject() but with an id property', () => {
        class Customer {
            id = '';
        }
        fromEvent(SomeEvent)(Customer);

        it('should fall back to the id property as the subject, unchanged from today', async () => {
            const { readModels, release } = createReadModels(Customer);
            const instance = new Customer();
            instance.id = 'customer-7';

            await readModels.release(Customer, instance);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'customer-7' }));
        });
    });

    describe('when releasing a read model with neither @subject() nor an id property', () => {
        class Anonymous {
            name = '';
        }
        fromEvent(SomeEvent)(Anonymous);

        it('should throw, same as today', async () => {
            const { readModels } = createReadModels(Anonymous);
            const instance = new Anonymous();

            await expect(readModels.release(Anonymous, instance)).rejects.toThrow(/subject/);
        });
    });

    describe('when releasing many read model instances', () => {
        class Customer {
            id = '';
        }
        fromEvent(SomeEvent)(Customer);

        it('should release each instance using its own resolved subject', async () => {
            const { readModels, release } = createReadModels(Customer);
            const first = new Customer();
            first.id = 'customer-1';
            const second = new Customer();
            second.id = 'customer-2';

            await readModels.releaseMany(Customer, [first, second]);

            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'customer-1' }));
            expect(release).toHaveBeenCalledWith(expect.objectContaining({ Subject: 'customer-2' }));
        });
    });
});
