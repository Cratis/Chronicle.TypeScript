// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { IProjectionBuilderFor } from '../../../projections/declarative/IProjectionBuilderFor.js';
import { IProjectionFor } from '../../../projections/declarative/IProjectionFor.js';
import { projection } from '../../../projections/declarative/projection.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { Projections } from '../../../projections/Projections.js';
import { reducer } from '../../../reducers/reducer.js';
import { Reducers } from '../../../reducers/Reducers.js';
import { ReadModels } from '../../ReadModels.js';
import type { ReadModelNamingPolicy } from '../../ReadModelNamingPolicy.js';

export class AccountOpened { owner!: string; }
eventType()(AccountOpened);

export class AccountSummary { id!: string; owner!: string; }
export class AccountSummaryProjection implements IProjectionFor<AccountSummary> {
    define(builder: IProjectionBuilderFor<AccountSummary>): void {
        builder.from(AccountOpened);
    }
}
projection('AccountSummary', AccountSummary)(AccountSummaryProjection);

export class AccountBalance { id!: string; owner!: string; }
setFrom(AccountOpened, 'owner')(AccountBalance.prototype, 'owner');
fromEvent(AccountOpened)(AccountBalance);

export class AccountActivity { count = 0; }
export class AccountActivityReducer {
    accountOpened(_event: AccountOpened, current: AccountActivity | undefined): AccountActivity {
        return { count: (current?.count ?? 0) + 1 };
    }
}
reducer('account-activity', undefined, AccountActivity)(AccountActivityReducer);

/** Container name a policy that upper-cases the identifier and reports the class it was given. */
export const upperCasePolicy: ReadModelNamingPolicy = identifier => identifier.toUpperCase();

/** Identifies the class handed to the policy, or `none` when the read model has no class. */
export const classNamePolicy: ReadModelNamingPolicy = (identifier, readModelType) => `${identifier}:${readModelType?.name ?? 'none'}`;

export interface RegisteredReadModel {
    identifier: string;
    containerName: string;
    displayName: string;
}

function artifacts(overrides: Partial<IClientArtifactsProvider>): IClientArtifactsProvider {
    return {
        eventTypes: [AccountOpened],
        readModels: [],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: [],
        webhooks: [],
        eventTypeMigrations: [],
        globalForHandlers: [],
        ...overrides
    };
}

interface Definition {
    Type: { Identifier: string };
    ContainerName: string;
    DisplayName: string;
}

function toRegistered(registerMany: ReturnType<typeof vi.fn>): RegisteredReadModel[] {
    return registerMany.mock.calls.flatMap(call => (call[0].ReadModels as Definition[]).map(definition => ({
        identifier: definition.Type.Identifier,
        containerName: definition.ContainerName,
        displayName: definition.DisplayName
    })));
}

/** Registers a declarative projection through {@link Projections} and returns what reached the kernel. */
export async function registerDeclarativeProjection(policy?: ReadModelNamingPolicy): Promise<RegisteredReadModel[]> {
    const registerMany = vi.fn().mockResolvedValue(undefined);
    const connection = { projections: { register: vi.fn().mockResolvedValue(undefined) }, readModels: { registerMany } } as unknown as ChronicleConnection;
    const provider = artifacts({ projections: [AccountSummaryProjection], readModels: [AccountSummary] });
    await new Projections('store', 'Default', connection, provider, 'sink', policy).register();
    return toRegistered(registerMany);
}

/** Registers a model-bound projection through {@link Projections} and returns what reached the kernel. */
export async function registerModelBoundProjection(policy?: ReadModelNamingPolicy): Promise<RegisteredReadModel[]> {
    const registerMany = vi.fn().mockResolvedValue(undefined);
    const connection = { projections: { register: vi.fn().mockResolvedValue(undefined) }, readModels: { registerMany } } as unknown as ChronicleConnection;
    const provider = artifacts({ readModels: [AccountBalance] });
    await new Projections('store', 'Default', connection, provider, 'sink', policy).register();
    return toRegistered(registerMany);
}

/** Registers a reducer's read model through {@link Reducers} and returns what reached the kernel. */
export async function registerReducer(policy?: ReadModelNamingPolicy): Promise<RegisteredReadModel[]> {
    const registerMany = vi.fn().mockResolvedValue({});
    const observe = vi.fn().mockImplementation(async function* (queue: AsyncIterable<unknown>) {
        for await (const _message of queue) break;
    });
    const connection = { reducers: { observe }, readModels: { registerMany } } as unknown as ChronicleConnection;
    const provider = artifacts({ reducers: [AccountActivityReducer], readModels: [AccountActivity] });
    const lifecycle = new ConnectionLifecycle();
    const reducers = new Reducers(provider, connection, 'store', 'Default', lifecycle, 'sink', undefined, undefined, policy);
    try {
        await reducers.register();
    } finally {
        reducers.dispose();
    }
    return toRegistered(registerMany);
}

/** Registers read models directly through {@link ReadModels.register} and returns what reached the kernel. */
export async function registerDirectly(readModelType: Constructor, artifactOverrides: Partial<IClientArtifactsProvider>, policy?: ReadModelNamingPolicy): Promise<RegisteredReadModel[]> {
    const registerMany = vi.fn().mockResolvedValue(undefined);
    const connection = { readModels: { registerMany } } as unknown as ChronicleConnection;
    const readModels = new ReadModels('store', 'Default', connection, artifacts(artifactOverrides), 'sink', undefined, policy);
    await readModels.register(readModelType);
    return toRegistered(registerMany);
}

export const directProjection = (policy?: ReadModelNamingPolicy) =>
    registerDirectly(AccountSummary, { projections: [AccountSummaryProjection], readModels: [AccountSummary] }, policy);
export const directModelBound = (policy?: ReadModelNamingPolicy) =>
    registerDirectly(AccountBalance, { readModels: [AccountBalance] }, policy);
export const directReducer = (policy?: ReadModelNamingPolicy) =>
    registerDirectly(AccountActivity, { reducers: [AccountActivityReducer], readModels: [AccountActivity] }, policy);
