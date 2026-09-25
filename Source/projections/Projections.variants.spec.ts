// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { entersOn } from './modelBound/entersOn.js';
import { fromEvent } from './modelBound/fromEvent.js';
import { globalFor } from './modelBound/globalFor.js';
import { setFrom } from './modelBound/setFrom.js';
import { variantOf } from './modelBound/variantOf.js';
import { GlobalHandlerPropertyNotOnVariant } from './GlobalHandlerPropertyNotOnVariant.js';
import { VariantMustDeclareEntersOnEvent } from './VariantMustDeclareEntersOnEvent.js';
import { Projections } from './Projections.js';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

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

class TitleChanged {
    title!: string;
}
eventType()(TitleChanged);

/** Anchors the logical identity shared by every variant below. Never itself a read model. */
class WorkItem {}

class BacklogItem {
    id!: string;
    title!: string;
}
setFrom(IssueCreated, 'title')(BacklogItem.prototype, 'title');
variantOf(WorkItem, 'id')(BacklogItem);
entersOn(IssueCreated)(BacklogItem);
fromEvent(IssueCreated)(BacklogItem);

class PullRequestItem {
    id!: string;
    title!: string;
    pullRequestUrl!: string;
    buildStatus!: string;
}
setFrom(PullRequestCreated, 'pullRequestUrl')(PullRequestItem.prototype, 'pullRequestUrl');
setFrom(BuildCompleted, 'buildStatus')(PullRequestItem.prototype, 'buildStatus');
variantOf(WorkItem, 'id')(PullRequestItem);
entersOn(PullRequestCreated)(PullRequestItem);
fromEvent(PullRequestCreated)(PullRequestItem);
fromEvent(BuildCompleted)(PullRequestItem);

/** A shared handler with no entering event of its own - never registered as its own projection. */
class TitleHandler {
    title!: string;
}
setFrom(TitleChanged, 'title')(TitleHandler.prototype, 'title');
globalFor(WorkItem)(TitleHandler);

/** A variant missing an entersOn declaration entirely. */
class UndeclaredVariant {
    id!: string;
    title!: string;
}
setFrom(IssueCreated, 'title')(UndeclaredVariant.prototype, 'title');
variantOf(WorkItem, 'id')(UndeclaredVariant);
fromEvent(IssueCreated)(UndeclaredVariant);

/** A separate identity, used to prove sibling cross-wiring stays scoped to one identity. */
class OtherIdentity {}

class OtherVariant {
    id!: string;
}
variantOf(OtherIdentity, 'id')(OtherVariant);
entersOn(IssueCreated)(OtherVariant);
fromEvent(IssueCreated)(OtherVariant);

interface CapturedDefinition {
    Identifier: string;
    From: Array<{ Key: { Id: string }; Value: { Properties: Record<string, string>; Key: string } }>;
    Join: Array<{ Key: { Id: string }; Value: { On: string; Properties: Record<string, string>; Key: string } }>;
    RemovedWith: Array<{ Key: { Id: string }; Value: { Key: string; ParentKey: string } }>;
}

function createProjections(readModels: (new (...args: unknown[]) => unknown)[], globalForHandlers: (new (...args: unknown[]) => unknown)[] = []) {
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
        eventTypeMigrations: [],
        globalForHandlers: globalForHandlers as unknown as IClientArtifactsProvider['globalForHandlers']
    };

    const projections = new Projections('test-store', 'test-namespace', connection, clientArtifacts, 'test-sink');
    return { projections, registerMock };
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
    describe('when registering a variant that enters on its own event', () => {
        it('should keep the entering event as a create-or-update From handler', async () => {
            const { projections, registerMock } = createProjections([BacklogItem, PullRequestItem]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            const backlogItem = definitions.get('BacklogItem')!;
            const issueCreated = backlogItem.From.find(entry => entry.Key.Id === 'IssueCreated');
            expect(issueCreated).toBeDefined();
            expect(issueCreated!.Value.Properties.title).toBe('title');
        });
    });

    describe('when a variant projects from an event that is not its entering event', () => {
        it('should reclassify it into an update-only self-referential join', async () => {
            const { projections, registerMock } = createProjections([BacklogItem, PullRequestItem]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            const pullRequestItem = definitions.get('PullRequestItem')!;

            expect(pullRequestItem.From.some(entry => entry.Key.Id === 'BuildCompleted')).toBe(false);

            const buildCompletedJoin = pullRequestItem.Join.find(entry => entry.Key.Id === 'BuildCompleted');
            expect(buildCompletedJoin).toBeDefined();
            expect(buildCompletedJoin!.Value.On).toBe('id');
            expect(buildCompletedJoin!.Value.Key).toBe('$eventSourceId');
            expect(buildCompletedJoin!.Value.Properties.buildStatus).toBe('buildStatus');
        });
    });

    describe('when two variants of the same identity are registered together', () => {
        it('should cross-wire mutual exclusion between them', async () => {
            const { projections, registerMock } = createProjections([BacklogItem, PullRequestItem]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            const backlogItem = definitions.get('BacklogItem')!;
            const pullRequestItem = definitions.get('PullRequestItem')!;

            const backlogRemovedByPullRequest = backlogItem.RemovedWith.find(entry => entry.Key.Id === 'PullRequestCreated');
            expect(backlogRemovedByPullRequest).toBeDefined();

            const pullRequestRemovedByBacklog = pullRequestItem.RemovedWith.find(entry => entry.Key.Id === 'IssueCreated');
            expect(pullRequestRemovedByBacklog).toBeDefined();
        });

        it('should not cross-wire a variant of a different identity', async () => {
            const { projections, registerMock } = createProjections([BacklogItem, PullRequestItem, OtherVariant]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            const otherVariant = definitions.get('OtherVariant')!;

            expect(otherVariant.RemovedWith.length).toBe(0);
        });
    });

    describe('when a globalFor shared handler applies to a group', () => {
        it('should merge its mapping into every variant', async () => {
            const { projections, registerMock } = createProjections([BacklogItem, PullRequestItem], [TitleHandler]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            const backlogItem = definitions.get('BacklogItem')!;
            const pullRequestItem = definitions.get('PullRequestItem')!;

            const backlogTitleChanged = backlogItem.Join.find(entry => entry.Key.Id === 'TitleChanged');
            expect(backlogTitleChanged).toBeDefined();
            expect(backlogTitleChanged!.Value.Properties.title).toBe('title');

            const pullRequestTitleChanged = pullRequestItem.Join.find(entry => entry.Key.Id === 'TitleChanged');
            expect(pullRequestTitleChanged).toBeDefined();
            expect(pullRequestTitleChanged!.Value.Properties.title).toBe('title');
        });

        it('should never register the shared handler as its own projection', async () => {
            const { projections, registerMock } = createProjections([BacklogItem, PullRequestItem], [TitleHandler]);

            await projections.register();

            const definitions = definitionsFor(registerMock);
            expect(definitions.has('TitleHandler')).toBe(false);
        });
    });

    describe('when a variant does not declare an entersOn event', () => {
        it('should throw VariantMustDeclareEntersOnEvent', async () => {
            const { projections } = createProjections([UndeclaredVariant]);

            await expect(projections.register()).rejects.toThrow(VariantMustDeclareEntersOnEvent);
        });
    });

    describe('when a globalFor shared handler maps to a property a variant does not have', () => {
        class MismatchedHandler {
            unrelatedProperty!: string;
        }
        setFrom(TitleChanged, 'title')(MismatchedHandler.prototype, 'unrelatedProperty');
        globalFor(WorkItem)(MismatchedHandler);

        it('should throw GlobalHandlerPropertyNotOnVariant', async () => {
            const { projections } = createProjections([BacklogItem, PullRequestItem], [MismatchedHandler]);

            await expect(projections.register()).rejects.toThrow(GlobalHandlerPropertyNotOnVariant);
        });
    });
});
