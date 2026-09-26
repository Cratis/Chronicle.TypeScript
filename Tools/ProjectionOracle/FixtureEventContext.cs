// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelConcepts;

using System.Globalization;
using System.Text.Json.Nodes;
using Concepts = KernelConcepts::Cratis.Chronicle.Concepts;

namespace ProjectionOracle;

/// <summary>
/// Parses the event metadata that the production value providers can read.
/// </summary>
internal static class FixtureEventContext
{
    public static Concepts.Events.EventContext Read(JsonObject node)
    {
        Only(node, "eventType", "eventSourceType", "eventSourceId", "eventStreamType", "eventStreamId",
            "sequenceNumber", "occurred", "eventStore", "namespace", "correlationId", "causation",
            "causedBy", "tags", "hash", "subject");
        var eventSourceId = node["eventSourceId"]!.GetValue<string>();
        var type = node["eventType"]!.AsObject();
        Only(type, "Id", "Generation");
        return Concepts.Events.EventContext.Empty with
        {
            EventType = new Concepts.Events.EventType(
                new Concepts.Events.EventTypeId(type["Id"]!.GetValue<string>()),
                new Concepts.Events.EventTypeGeneration(type["Generation"]!.GetValue<uint>())),
            EventSourceType = node["eventSourceType"] is null ? Concepts.Events.EventSourceType.Default : new(node["eventSourceType"]!.GetValue<string>()),
            EventSourceId = (Concepts.Events.EventSourceId)eventSourceId,
            EventStreamType = node["eventStreamType"] is null ? Concepts.Events.EventStreamType.All : new(node["eventStreamType"]!.GetValue<string>()),
            EventStreamId = node["eventStreamId"] is null ? Concepts.Events.EventStreamId.Default : new(node["eventStreamId"]!.GetValue<string>()),
            SequenceNumber = (Concepts.Events.EventSequenceNumber)ulong.Parse(node["sequenceNumber"]!.GetValue<string>(), CultureInfo.InvariantCulture),
            Occurred = DateTimeOffset.Parse(node["occurred"]!.GetValue<string>(), CultureInfo.InvariantCulture),
            EventStore = node["eventStore"] is null ? Concepts.EventStoreName.NotSet : (Concepts.EventStoreName)node["eventStore"]!.GetValue<string>(),
            Namespace = node["namespace"] is null ? Concepts.EventStoreNamespaceName.NotSet : (Concepts.EventStoreNamespaceName)node["namespace"]!.GetValue<string>(),
            CorrelationId = node["correlationId"] is null ? Concepts.Events.EventContext.Empty.CorrelationId : new(Guid.Parse(node["correlationId"]!.GetValue<string>())),
            Causation = node["causation"]?.AsArray().Select(ReadCausation).ToArray() ?? [],
            CausedBy = node["causedBy"] is JsonObject identity ? ReadIdentity(identity) : Concepts.Identities.Identity.NotSet,
            Tags = node["tags"]?.AsArray().Select(tag => new Concepts.Events.Tag(tag!.GetValue<string>())).ToArray() ?? [],
            Hash = node["hash"] is null ? Concepts.Events.EventHash.NotSet : new(node["hash"]!.GetValue<string>()),
            Subject = new Concepts.Events.Subject(node["subject"]?.GetValue<string>() ?? eventSourceId)
        };
    }

    static Concepts.Auditing.Causation ReadCausation(JsonNode? node)
    {
        var value = node!.AsObject();
        Only(value, "occurred", "type", "properties");
        return new(
            DateTimeOffset.Parse(value["occurred"]!.GetValue<string>(), CultureInfo.InvariantCulture),
            new Concepts.Auditing.CausationType(value["type"]!.GetValue<string>()),
            value["properties"]!.AsObject().ToDictionary(entry => entry.Key, entry => entry.Value!.GetValue<string>()));
    }

    static Concepts.Identities.Identity ReadIdentity(JsonObject value)
    {
        Only(value, "subject", "name", "userName", "onBehalfOf");
        return new(value["subject"]!.GetValue<string>(), value["name"]!.GetValue<string>(),
            value["userName"]?.GetValue<string>() ?? string.Empty,
            value["onBehalfOf"] is JsonObject parent ? ReadIdentity(parent) : null);
    }

    static void Only(JsonObject node, params string[] fields)
    {
        foreach (var field in node.Select(entry => entry.Key))
        {
            if (!fields.Contains(field, StringComparer.Ordinal))
            {
                throw new InvalidOperationException($"Unknown fixture context field '{field}'.");
            }
        }
    }
}
