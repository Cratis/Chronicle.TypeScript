// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import type { ChronicleConnection } from '../connection/ChronicleConnection.js';
import { Constraints } from './constraints/Constraints.js';
import { constraint, getConstraintMetadata } from './constraints/constraint.js';
import { unique, getUniqueEventMetadata, getUniquePropertyMetadata } from './constraints/unique.js';
import { removeConstraint, getRemovedConstraintNames } from './constraints/removeConstraint.js';
import { eventType, getEventTypeMetadata } from './eventTypeDecorator.js';
import { filterEventsByTag, getFilterTagsFor } from './filterEventsByTagDecorator.js';
import { eventTypeMigration, getEventTypeMigrationMetadata } from './migrations/eventTypeMigration.js';
import { tag, tags, getTagsFor } from './tagDecorator.js';
import { entersOn, getEntersOnMetadata } from '../projections/modelBound/entersOn.js';
import { eventLog, eventSequence, getEventSequenceMetadata } from '../projections/modelBound/eventSequence.js';
import { fromEvent, getFromEventMetadata } from '../projections/modelBound/fromEvent.js';
import { getGlobalForMetadata, globalFor } from '../projections/modelBound/globalFor.js';
import { isNotRewindable, notRewindable } from '../projections/modelBound/notRewindable.js';
import { isPassive, passive } from '../projections/modelBound/passive.js';
import { getVariantOfMetadata, variantOf } from '../projections/modelBound/variantOf.js';
import { getSeederMetadata, seeder } from '../seeding/seeder.js';
import { getWebhookMetadata, webhook } from '../webhooks/webhook.js';

@eventType('migration-fixture', 1)
class Previous {}

@eventType('migration-fixture', 2)
class Upgraded {}

@eventTypeMigration(Upgraded, Previous)
class Migration {}

@constraint('standard-constraint')
class Constraint {}

@eventType('standard-unique-property')
class UniquePropertyEvent {
    @unique('standard-unique-name', 'Already taken') name = '';
}

@eventType('standard-unique-class')
@unique('standard-unique-type', 'Already registered')
class UniqueEvent {}

@eventType('standard-unique-release')
@removeConstraint('standard-unique-name')
@removeConstraint('standard-unique-type')
class UniqueRelease {}

@tag('first')
@tags('second')
@filterEventsByTag('required')
class Tagged {}

@fromEvent(Upgraded)
@entersOn(Upgraded)
@eventSequence('sequence')
@passive
@notRewindable
class ModelBound {}

@eventLog
class EventLogModel {}

@globalFor(Upgraded)
class GlobalHandler {}

@variantOf(Upgraded, 'kind')
class Variant {}

@seeder()
class Seeder {}

@webhook('standard-webhook', 'https://example.com/hooks')
class Webhook {}

describe('standard class decorators', () => {
    it('retains class registrations and metadata without legacy decorator syntax', () => {
        expect(getEventTypeMetadata(Previous)?.schema.properties).toEqual({});
        expect(getEventTypeMigrationMetadata(Migration)?.eventType.generation.value).toBe(2);
        expect(getConstraintMetadata(Constraint)?.id.value).toBe('standard-constraint');
        expect(getUniquePropertyMetadata(UniquePropertyEvent, 'name')).toEqual({ name: 'standard-unique-name', message: 'Already taken' });
        expect(getUniqueEventMetadata(UniqueEvent)).toEqual({ name: 'standard-unique-type', message: 'Already registered' });
        expect(getRemovedConstraintNames(UniqueRelease)).toEqual(['standard-unique-type', 'standard-unique-name']);
        expect(getTagsFor(Tagged).map(item => item.value)).toEqual(['second', 'first']);
        expect(getFilterTagsFor(Tagged).map(item => item.value)).toEqual(['required']);
        expect(getFromEventMetadata(ModelBound)).toHaveLength(1);
        expect(getEntersOnMetadata(ModelBound)).toHaveLength(1);
        expect(getEventSequenceMetadata(ModelBound)).toBe('sequence');
        expect(isPassive(ModelBound)).toBe(true);
        expect(isNotRewindable(ModelBound)).toBe(true);
        expect(getEventSequenceMetadata(EventLogModel)).toBeDefined();
        expect(getGlobalForMetadata(GlobalHandler)?.identity).toBe(Upgraded);
        expect(getVariantOfMetadata(Variant)?.identity).toBe(Upgraded);
        expect(getSeederMetadata(Seeder)?.isSeeder).toBe(true);
        expect(getWebhookMetadata(Webhook)?.targetUrl.value).toBe('https://example.com/hooks');
    });

    it('registers standard-decorated constraints through normal artifact discovery', async () => {
        const register = vi.fn().mockResolvedValue({});
        const connection = { constraints: { register } } as unknown as ChronicleConnection;
        const artifacts = {
            eventTypes: DefaultClientArtifactsProvider.default.eventTypes.filter(type =>
                [UniquePropertyEvent, UniqueEvent, UniqueRelease].includes(type)),
            constraints: []
        } as unknown as IClientArtifactsProvider;
        const constraints = new Constraints('store', connection, artifacts);
        await constraints.register();
        const definitions = register.mock.calls[0][0].Constraints;
        const property = definitions.find((definition: { Name: string }) => definition.Name === 'standard-unique-name');
        const eventType = definitions.find((definition: { Name: string }) => definition.Name === 'standard-unique-type');
        expect(property.Definition.Value0.EventDefinitions).toEqual([
            { EventTypeId: 'standard-unique-property', Properties: ['name'] }
        ]);
        expect(property.RemovedWith).toEqual(['standard-unique-release']);
        expect(eventType.Definition.Value1.EventTypeIds).toEqual(['standard-unique-class']);
        expect(eventType.RemovedWith).toEqual(['standard-unique-release']);
    });
});
