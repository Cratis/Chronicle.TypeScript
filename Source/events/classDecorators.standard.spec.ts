// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { constraint, getConstraintMetadata } from './constraints/constraint.js';
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
});
