// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// This file is emitted by the ordinary build and run by plain Node, never by a TS loader.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock } from 'node:test';
import { field } from '@cratis/fundamentals';
import { ChronicleClient, ChronicleOptions, ClientObserversRequireKeepAlive, eventType, reactor, reducer,
    type IClientArtifactsProvider } from '../../index.js';
import { ChronicleConnection } from '../../connection/ChronicleConnection.js';

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
const skipKeepAlive = !mode.startsWith('default');
const intervals = mock.method(globalThis, 'setInterval');
const streamSpies: ReturnType<typeof spyOnConnectStream>[] = [];
function spyOnConnectStream(connection: ChronicleConnection) {
    // The spy delegates to the real RPC; it never substitutes a stream or owns the channel.
    return mock.method(connection.connections, 'connect');
}
const connect = ChronicleConnection.prototype.connect;
mock.method(ChronicleConnection.prototype, 'connect', async function (this: ChronicleConnection) {
    await connect.call(this);
    streamSpies.push(spyOnConnectStream(this));
});
function connectionCounts() {
    const connectCalls = streamSpies.reduce((total, spy) => total + spy.mock.callCount(), 0);
    const watchdogTimers = intervals.mock.calls.filter(call => call.arguments[1] === 5000).length;
    assert.equal(connectCalls > 0, !skipKeepAlive);
    assert.equal(watchdogTimers > 0, !skipKeepAlive);
    return { connectCalls, watchdogTimers };
}
const artifacts: IClientArtifactsProvider = {
    eventTypes: [ExitItem], reactors: mode === 'reactor' ? [ExitReactor] : [], reducers: mode === 'reducer' ? [ExitReducer] : [],
    readModels: [], seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};
const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
    skipKeepAlive, discoveryPatterns: [], clientArtifactsProvider: artifacts
}));
if (mode === 'preconnect-dispose') {
    client.dispose();
    client.dispose();
    assert.equal(streamSpies.length, 0);
    console.log(JSON.stringify({ marker: 'disposed-before-connect', mode, ...connectionCounts() }));
} else if (mode === 'reactor' || mode === 'reducer') {
    try {
        await client.getEventStore('skip-exit-refusal');
        throw new Error('Observer was not refused');
    } catch (error) {
        if (!(error instanceof ClientObserversRequireKeepAlive)) throw error;
        assert.equal(streamSpies.length, 0);
        console.log(JSON.stringify({ marker: 'observer-refused', mode, kind: error.observerKind, id: error.observerId,
            ...connectionCounts() }));
    }
} else {
    const store = await client.getEventStore(`skip-exit-${randomUUID()}`);
    const source = randomUUID();
    const item = new ExitItem();
    item.value = randomUUID();
    await store.eventLog.append(source, item);
    const events = await store.eventLog.getForEventSourceIdAndEventTypes(source, [ExitItem]);
    assert.deepEqual(events.map(event => event.content.value), [item.value]);
    const counts = connectionCounts();
    if (mode.endsWith('-dispose')) {
        client.dispose();
        client.dispose();
    }
    console.log(JSON.stringify({ marker: 'operations-completed', mode, source, expected: item.value,
        actual: events[0].content.value, ...counts }));
}
mock.restoreAll();
// The skip/default no-dispose variants deliberately leave all real client resources untouched.
// No variant calls process.exit(), unref(), or manually closes a stream or channel.
