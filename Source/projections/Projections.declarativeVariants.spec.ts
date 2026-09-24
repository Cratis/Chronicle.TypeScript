// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { IProjectionBuilderFor } from './declarative/IProjectionBuilderFor.js';
import { IProjectionFor } from './declarative/IProjectionFor.js';
import { projection } from './declarative/projection.js';
import { Projections } from './Projections.js';
import { VariantMustDeclareEntersOnEvent } from './VariantMustDeclareEntersOnEvent.js';

class IssueCreated {
    title!: string;
}
eventType()(IssueCreated);

class PullRequestCreated {
    pullRequestUrl!: string;
}
eventType()(PullRequestCreated);

class BuildCompleted {
    buildStatus!: string;
}
eventType()(BuildCompleted);

/** Anchors the logical identity shared by the two declarative variants below. */
class DecWorkItem {}

class DecBacklogItem {
    id!: string;
    title!: string;
}

class DecBacklogItemProjection implements IProjectionFor<DecBacklogItem> {
    define(builder: IProjectionBuilderFor<DecBacklogItem>): void {
        builder.variantOf(DecWorkItem, m => m.id).entersOn(IssueCreated);
    }
}
projection('DecBacklogItem', DecBacklogItem)(DecBacklogItemProjection);

class DecPullRequestItem {
    id!: string;
    pullRequestUrl!: string;
    buildStatus!: string;
}

class DecPullRequestItemProjection implements IProjectionFor<DecPullRequestItem> {
    define(builder: IProjectionBuilderFor<DecPullRequestItem>): void {
        builder
            .variantOf(DecWorkItem, m => m.id)
            .entersOn(PullRequestCreated)
            .from(PullRequestCreated)
            .from(BuildCompleted);
    }
}
projection('DecPullRequestItem', DecPullRequestItem)(DecPullRequestItemProjection);

class DecUndeclaredVariant {
    id!: string;
}

class DecUndeclaredVariantProjection implements IProjectionFor<DecUndeclaredVariant> {
    define(builder: IProjectionBuilderFor<DecUndeclaredVariant>): void {
        builder.variantOf(DecWorkItem, m => m.id).from(IssueCreated);
    }
}
projection('DecUndeclaredVariant', DecUndeclaredVariant)(DecUndeclaredVariantProjection);

interface CapturedDefinition {
    Identifier: string;
    From: Array<{ Key: { Id: string }; Value: { Properties: Record<string, string>; Key: string } }>;
    Join: Array<{ Key: { Id: string }; Value: { On: string; Properties: Record<string, string>; Key: string } }>;
    RemovedWith: Array<{ Key: { Id: string }; Value: { Key: string; ParentKey: string } }>;
}

function createProjections(projections: (new (...args: unknown[]) => unknown)[]) {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const registerManyMock = vi.fn().mockResolvedValue(undefined);
    const connection = {
        readModels: { registerMany: registerManyMock },
        projections: { register: registerMock }
    } as unknown as ChronicleConnection;

    const clientArtifacts: IClientArtifactsProvider = {
        eventTypes: [],
        readModels: [],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: projections as unknown as IClientArtifactsProvider['projections'],
        webhooks: [],
        eventTypeMigrations: [],
        globalForHandlers: []
    };

    const projectionsInstance = new Projections('test-store', 'test-namespace', connection, clientArtifacts, 'test-sink');
    return { projections: projectionsInstance, registerMock };
}

function definitionsFor(registerMock: ReturnType<typeof vi.fn>): Map<string, CapturedDefinition> {
    const byIdentifier = new Map<string, CapturedDefinition>();
    for (const call of registerMock.mock.calls) {
        const request = call[0] as { Projections: CapturedDefinition[] };
        for (const definition of request.Projections) {
            byIdentifier.set(definition.Identifier, definition);
        }
    }
    return byIdentifier;
}

describe('Projections', () => {
    describe('when registering a declarative variant that projects from an event that is not its entering event', () => {
        it('should reclassify it into an update-only self-referential join', async () => {
            const { projections, registerMock } = createProjections([DecBacklogItemProjection, DecPullRequestItemProjection]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            const pullRequestItem = definitions.get('DecPullRequestItem')!;

            expect(pullRequestItem.From.some(entry => entry.Key.Id === 'BuildCompleted')).toBe(false);

            const buildCompletedJoin = pullRequestItem.Join.find(entry => entry.Key.Id === 'BuildCompleted');
            expect(buildCompletedJoin).toBeDefined();
            expect(buildCompletedJoin!.Value.On).toBe('id');
            expect(buildCompletedJoin!.Value.Key).toBe('$eventSourceId');
        });
    });

    describe('when two declarative variants of the same identity are registered together', () => {
        it('should cross-wire mutual exclusion between them', async () => {
            const { projections, registerMock } = createProjections([DecBacklogItemProjection, DecPullRequestItemProjection]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            const backlogItem = definitions.get('DecBacklogItem')!;
            const pullRequestItem = definitions.get('DecPullRequestItem')!;

            expect(backlogItem.RemovedWith.some(entry => entry.Key.Id === 'PullRequestCreated')).toBe(true);
            expect(pullRequestItem.RemovedWith.some(entry => entry.Key.Id === 'IssueCreated')).toBe(true);
        });
    });

    describe('when a declarative variant does not declare an entersOn event', () => {
        it('should throw VariantMustDeclareEntersOnEvent', async () => {
            const { projections } = createProjections([DecUndeclaredVariantProjection]);

            await expect(projections.register()).rejects.toThrow(VariantMustDeclareEntersOnEvent);
        });
    });
});
