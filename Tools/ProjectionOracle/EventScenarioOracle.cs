// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Testing.EventSequences;

namespace ProjectionOracle;

[EventType("OracleEventRecorded")]
public record OracleEventRecorded(string Name, bool Active);

internal static class EventScenarioOracle
{
    internal static async Task<JsonNode> Run(JsonObject fixture)
    {
        using var scenario = new EventScenario();
        var actions = fixture["actions"]!.AsArray();
        var results = new JsonArray();
        foreach (var action in actions)
        {
            var source = action!["source"]!.GetValue<string>();
            var value = new OracleEventRecorded(action["name"]!.GetValue<string>(), action["active"]!.GetValue<bool>());
            var result = await scenario.EventLog.Append(source, value);
            results.Add(new JsonObject { ["success"] = result.IsSuccess, ["sequenceNumber"] = result.SequenceNumber.Value.ToString() });
        }
        var events = await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First);
        var history = new JsonArray();
        foreach (var entry in events)
        {
            history.Add(new JsonObject
            {
                ["sequenceNumber"] = entry.Context.SequenceNumber.Value.ToString(),
                ["source"] = entry.Context.EventSourceId.Value,
                ["sourceType"] = entry.Context.EventSourceType.Value,
                ["streamType"] = entry.Context.EventStreamType.Value,
                ["streamId"] = entry.Context.EventStreamId.Value,
                ["subject"] = entry.Context.Subject.Value,
                ["store"] = entry.Context.EventStore.Value,
                ["namespace"] = entry.Context.Namespace.Value,
                ["occurredValid"] = entry.Context.Occurred.Year > 2020,
                ["correlationValid"] = Guid.TryParse(entry.Context.CorrelationId.Value.ToString(), out _),
                ["causationCount"] = entry.Context.Causation.Count(),
                ["tagsCount"] = entry.Context.Tags.Count(),
                ["causedByName"] = entry.Context.CausedBy.Name,
                ["eventType"] = entry.Context.EventType.Id.Value,
                ["generation"] = entry.Context.EventType.Generation.Value,
                ["hash"] = entry.Context.Hash.Value,
                ["content"] = new JsonObject {
                    ["name"] = ((OracleEventRecorded)entry.Content).Name,
                    ["active"] = ((OracleEventRecorded)entry.Content).Active
                }
            });
        }
        var sourceA = await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, "A");
        var fromOne = await scenario.EventLog.GetFromSequenceNumber((EventSequenceNumber)1UL);
        var byType = await scenario.EventLog.GetForEventSourceIdAndEventTypes("A", [new EventType("OracleEventRecorded", 1)]);
        return new JsonObject {
            ["sourceA"] = new JsonArray(sourceA.Select(item => (JsonNode?)JsonValue.Create(item.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["byType"] = new JsonArray(byType.Select(item => (JsonNode?)JsonValue.Create(item.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailA"] = (await scenario.EventLog.GetTailSequenceNumber("A")).Value.ToString(),
            ["fromOne"] = new JsonArray(fromOne.Select(item => (JsonNode?)JsonValue.Create(item.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["results"] = results,
            ["history"] = history,
            ["next"] = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString(),
            ["tail"] = (await scenario.EventLog.GetTailSequenceNumber()).Value.ToString(),
            ["hasSourceA"] = await scenario.EventLog.HasEventsFor("A")
        };
    }
}
