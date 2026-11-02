// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// This file is emitted by the ordinary build and run by plain Node, never by a TS loader.
import { randomUUID } from 'node:crypto';
import { field } from '@cratis/fundamentals';
import { ChronicleClient, ChronicleOptions, ClientObserversRequireKeepAlive, eventType, reactor, reducer,
    type IClientArtifactsProvider } from '../../index.js';

@eventType('skip-keep-alive-exit-item')
class ExitItem {
    @field(String) value = 'probe';
}
@reactor('exit-reactor')
class ExitReactor {}
@reducer('exit-reducer')
class ExitReducer {}

const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;
if (!connectionString) throw new Error('CHRONICLE_INTEGRATION_CONNECTION_STRING is required');
const mode = process.argv[2];
const artifacts: IClientArtifactsProvider = {
    eventTypes: [ExitItem], reactors: mode === 'reactor' ? [ExitReactor] : [], reducers: mode === 'reducer' ? [ExitReducer] : [],
    readModels: [], seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};
const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
    skipKeepAlive: mode !== 'default', discoveryPatterns: [], clientArtifactsProvider: artifacts
}));
if (mode === 'reactor' || mode === 'reducer') {
    try {
        await client.getEventStore('skip-exit-refusal');
        throw new Error('Observer was not refused');
    } catch (error) {
        if (!(error instanceof ClientObserversRequireKeepAlive)) throw error;
        console.log(JSON.stringify({ marker: 'observer-refused', mode, kind: error.observerKind, id: error.observerId }));
    }
} else {
    const store = await client.getEventStore(`skip-exit-${randomUUID()}`);
    await store.eventLog.append(randomUUID(), new ExitItem());
    const tail = await store.eventLog.getTailSequenceNumber();
    console.log(JSON.stringify({ marker: 'operations-completed', mode, tail: tail.value.toString() }));
}
// Intentionally no dispose(), process.exit(), timer unref(), or forced stream cleanup.
