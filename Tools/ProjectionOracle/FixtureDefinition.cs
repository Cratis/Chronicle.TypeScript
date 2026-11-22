// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelContracts;

using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Nodes;
using ContractEventType = KernelContracts::Cratis.Chronicle.Contracts.Events.EventType;
using ContractFrom = KernelContracts::Cratis.Chronicle.Contracts.Projections.FromDefinition;
using ContractJoin = KernelContracts::Cratis.Chronicle.Contracts.Projections.JoinDefinition;
using ContractRemoval = KernelContracts::Cratis.Chronicle.Contracts.Projections.RemovedWithDefinition;
using ContractDefinition = KernelContracts::Cratis.Chronicle.Contracts.Projections.ProjectionDefinition;
using ContractChildren = KernelContracts::Cratis.Chronicle.Contracts.Projections.ChildrenDefinition;
using ContractAll = KernelContracts::Cratis.Chronicle.Contracts.Projections.FromEveryDefinition;
using ContractEventProperty = KernelContracts::Cratis.Chronicle.Contracts.Projections.FromEventPropertyDefinition;

namespace ProjectionOracle;

/// <summary>
/// Reads TypeScript's array-of-key/value wire dictionaries without inventing projection semantics.
/// </summary>
internal static class FixtureDefinition
{
    static readonly JsonSerializerOptions _strict = new() { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow };

    public static ContractDefinition Read(JsonObject node)
    {
        Only(node, "EventSequenceId", "Identifier", "ReadModel", "IsActive", "IsRewindable", "InitialModelState",
            "From", "Join", "Children", "FromEvery", "All", "FromEventProperty", "RemovedWith",
            "RemovedWithJoin", "Tags", "AutoMap", "Nested", "SubscribesToAllEvents", "NoAutoMapProperties", "LastUpdated");
        var definition = new ContractDefinition
        {
            EventSequenceId = node["EventSequenceId"]!.GetValue<string>(),
            Identifier = node["Identifier"]!.GetValue<string>(),
            ReadModel = node["ReadModel"]!.GetValue<string>(),
            IsActive = node["IsActive"]!.GetValue<bool>(),
            IsRewindable = node["IsRewindable"]!.GetValue<bool>(),
            InitialModelState = node["InitialModelState"]!.GetValue<string>(),
            SubscribesToAllEvents = node["SubscribesToAllEvents"]?.GetValue<bool>() ?? false,
            AutoMap = (KernelContracts::Cratis.Chronicle.Contracts.Projections.AutoMap)node["AutoMap"]!.GetValue<int>(),
            NoAutoMapProperties = node["NoAutoMapProperties"]!.AsArray().Select(item => item!.GetValue<string>()).ToList()
        };
        ReadEntries<ContractFrom>(node["From"]!.AsArray(), definition.From);
        ReadEntries<ContractRemoval>(node["RemovedWith"]!.AsArray(), definition.RemovedWith);
        ReadEntries<ContractJoin>(node["Join"]!.AsArray(), definition.Join);
        RejectRootOperations(node, definition);
        if (node["Children"] is JsonObject children)
        {
            foreach (var (property, child) in children)
            {
                definition.Children.Add(property, ReadChildren(child!.AsObject()));
            }
        }
        if (node["All"] is JsonObject all)
        {
            Only(all, "Properties", "IncludeChildren", "AutoMap");
            definition.All = all.Deserialize<ContractAll>(_strict)!;
        }
        return definition;
    }

    static void ReadEntries<T>(JsonArray entries, IDictionary<ContractEventType, T> target)
    {
        foreach (var entry in entries)
        {
            Only(entry!.AsObject(), "Key", "Value");
            target.Add(entry["Key"]!.Deserialize<ContractEventType>(_strict)!, entry["Value"]!.Deserialize<T>(_strict)!);
        }
    }

    static void RejectRootOperations(JsonObject node, ContractDefinition definition)
    {
        var hasParentKey = definition.From.Values.Any(from => !string.IsNullOrEmpty(from.ParentKey));
        var hasRemovalParentKey = definition.RemovedWith.Values.Any(removal => !string.IsNullOrEmpty(removal.ParentKey));
        if (hasParentKey || hasRemovalParentKey)
        {
            throw new NotSupportedException("Oracle fixtures support root-level projections only.");
        }
        RejectNonemptyBranches(node, "", "FromEvery", "RemovedWithJoin", "Nested");
        var hasUnsupportedMetadata = (node["FromEventProperty"] ?? node["LastUpdated"]) is not null;
        var hasTags = node["Tags"] is JsonArray { Count: > 0 };
        if (hasUnsupportedMetadata || hasTags)
        {
            throw new NotSupportedException("Oracle fixture has unsupported FromEventProperty, LastUpdated or Tags operation.");
        }
    }

    static void RejectNonemptyBranches(JsonObject node, string prefix, params string[] fields)
    {
        foreach (var name in fields)
        {
            if (IsNonemptyBranch(node[name]))
            {
                throw new NotSupportedException($"Oracle fixture contains unsupported {prefix}{name} operation.");
            }
        }
    }

    static bool IsNonemptyBranch(JsonNode? node) => node switch
    {
        JsonArray array => array.Count != 0,
        JsonObject map => map.Count != 0,
        _ => false
    };

    /// <summary>
    /// Reads one level of children, including the pinned 19.30.0 FromEventProperty contract.
    /// </summary>
    static ContractChildren ReadChildren(JsonObject node)
    {
        Only(node, "IdentifiedBy", "From", "Join", "Children", "All", "FromEventProperty", "RemovedWith",
            "RemovedWithJoin", "AutoMap", "Nested", "NoAutoMapProperties");
        var children = new ContractChildren
        {
            IdentifiedBy = node["IdentifiedBy"]!.GetValue<string>(),
            AutoMap = (KernelContracts::Cratis.Chronicle.Contracts.Projections.AutoMap)node["AutoMap"]!.GetValue<int>(),
            NoAutoMapProperties = node["NoAutoMapProperties"]?.AsArray().Select(item => item!.GetValue<string>()).ToList() ?? []
        };
        ReadEntries<ContractFrom>(node["From"]!.AsArray(), children.From);
        ReadEntries<ContractRemoval>(node["RemovedWith"]!.AsArray(), children.RemovedWith);
        ReadEntries<ContractJoin>(node["Join"]!.AsArray(), children.Join);
        RejectNonemptyBranches(node, "child ", "Children", "RemovedWithJoin", "Nested");
        RejectChildAll(node["All"]);
        if (node["FromEventProperty"] is not null)
        {
            children.FromEventProperty = ReadEventProperty(node["FromEventProperty"]!.AsObject());
        }
        return children;
    }

    static void RejectChildAll(JsonNode? node)
    {
        if (node is not JsonObject all) return;
        Only(all, "Properties", "IncludeChildren", "AutoMap");
        var hasProperties = all["Properties"] is JsonObject { Count: > 0 };
        var includesChildren = all["IncludeChildren"]?.GetValue<bool>() == true;
        var overridesAutoMap = all["AutoMap"]?.GetValue<int>() != 0;
        if (new[] { hasProperties, includesChildren, overridesAutoMap }.Any(value => value))
        {
            throw new NotSupportedException("Oracle fixture has unsupported child All or FromEventProperty operation.");
        }
    }

    static ContractEventProperty ReadEventProperty(JsonObject node)
    {
        Only(node, "Event", "PropertyExpression");
        var eventType = Required(node, "Event").AsObject();
        Only(eventType, "Id", "Generation", "Tombstone");
        return new ContractEventProperty
        {
            Event = new ContractEventType
            {
                Id = Required(eventType, "Id").GetValue<string>(),
                Generation = Required(eventType, "Generation").GetValue<uint>(),
                Tombstone = eventType.ContainsKey("Tombstone") && Required(eventType, "Tombstone").GetValue<bool>()
            },
            PropertyExpression = Required(node, "PropertyExpression").GetValue<string>()
        };
    }

    static JsonNode Required(JsonObject node, string property) =>
        node[property] ?? throw new InvalidOperationException($"Missing fixture wire field '{property}'.");

    static void Only(JsonObject node, params string[] fields)
    {
        foreach (var field in node.Select(entry => entry.Key))
        {
            if (!fields.Contains(field, StringComparer.Ordinal))
            {
                throw new InvalidOperationException($"Unknown fixture wire field '{field}'.");
            }
        }
    }
}
