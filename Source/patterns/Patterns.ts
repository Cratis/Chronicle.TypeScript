// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { MatchingPatternsRequest } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../connection/index.js';
import { ensureQuerySuccess } from '../connection/callResults.js';
import type { BehaviorPattern } from './BehaviorPattern.js';
import { FacetName } from './FacetName.js';
import type { FacetSet } from './FacetSet.js';
import type { IPatterns } from './IPatterns.js';
import type { PatternMoment } from './PatternMoment.js';
import type { PatternQueryOptions } from './PatternQueryOptions.js';
import type { PatternsAtOptions } from './PatternsAtOptions.js';
import { toBehaviorPattern } from './toBehaviorPattern.js';
import { toDayOfWeek } from './toDayOfWeek.js';
import { toTimeBucket } from './toTimeBucket.js';

/** Implements {@link IPatterns} using the connection's pattern service. */
export class Patterns implements IPatterns {
    /**
     * Creates the pattern query surface for an event store namespace.
     * @param _eventStore - Event store name.
     * @param _namespace - Event store namespace.
     * @param _connection - Chronicle connection.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async getPatterns(scope: string, context: FacetSet, options: PatternQueryOptions = {}): Promise<BehaviorPattern[]> {
        const response = await this._connection.patterns.matchingPatterns(this.createRequest(scope, context, options));
        return ensureQuerySuccess('get patterns', response).map(toBehaviorPattern);
    }

    /** @inheritdoc */
    async getUsualActions(scope: string, context: FacetSet, options: PatternQueryOptions = {}): Promise<BehaviorPattern[]> {
        const response = await this._connection.patterns.usualActions(this.createRequest(scope, context, options));
        return ensureQuerySuccess('get usual actions', response).map(toBehaviorPattern);
    }

    /** @inheritdoc */
    async getPatternsAt(scope: string, moment?: PatternMoment, options: PatternsAtOptions = {}): Promise<BehaviorPattern[]> {
        if (!moment) {
            const instant = new Date();
            moment = { instant, offsetMinutes: -instant.getTimezoneOffset() };
        }
        const context: FacetSet = {
            ...options.alsoConstraining,
            [FacetName.Day]: toDayOfWeek(moment),
            [FacetName.TimeBucket]: toTimeBucket(moment)
        };
        return this.getUsualActions(scope, context, options);
    }

    /** @inheritdoc */
    async getPatternsForScope(scope: string): Promise<BehaviorPattern[]> {
        const response = await this._connection.patterns.patternsForScope({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            GroupingKey: scope
        });
        return ensureQuerySuccess('get patterns for scope', response).map(toBehaviorPattern);
    }

    /** @inheritdoc */
    async getScopes(): Promise<string[]> {
        const response = await this._connection.patterns.allPatternScopes({
            EventStore: this._eventStore,
            Namespace: this._namespace
        });
        return ensureQuerySuccess('get pattern scopes', response).map(scope => scope.Id);
    }

    private createRequest(scope: string, context: FacetSet, options: PatternQueryOptions): MatchingPatternsRequest {
        return {
            EventStore: this._eventStore,
            Namespace: this._namespace,
            GroupingKey: scope,
            Context: Object.fromEntries(Object.entries(context).filter(([, value]) => value.length > 0)),
            // Zero asks the server to use its configuration, rather than duplicating thresholds in the client.
            MinimumConfidence: options.minimumConfidence ?? 0,
            MaximumResults: options.maximumResults ?? 0
        };
    }
}
