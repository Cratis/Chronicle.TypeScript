// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelConcepts;
extern alias KernelContracts;

using System.Reflection;
using ContractDefinition = KernelContracts::Cratis.Chronicle.Contracts.Projections.ProjectionDefinition;
using KernelDefinition = KernelConcepts::Cratis.Chronicle.Concepts.Projections.Definitions.ProjectionDefinition;
using ProjectionOwner = KernelConcepts::Cratis.Chronicle.Concepts.Projections.ProjectionOwner;

namespace ProjectionOracle;

/// <summary>Only reflection boundary: the 19.8.1 internal wire-to-engine converter.</summary>
internal static class ProjectionDefinitionBridge
{
    const string ConverterName = "Cratis.Chronicle.Services.Projections.Definitions.ProjectionDefinitionConverters";

    static MethodInfo GetConverter()
    {
        var type = Assembly.Load("Cratis.Chronicle.Grpc").GetType(ConverterName);
        var method = type?.GetMethod("ToChronicle", BindingFlags.Public | BindingFlags.Static, [typeof(ContractDefinition), typeof(ProjectionOwner)]);
        if (type is null || !type.IsNotPublic || method is null || method.ReturnType != typeof(KernelDefinition) || method.GetParameters().Length != 2)
        {
            throw new InvalidOperationException("Chronicle Testing 19.8.1 projection converter signature changed: expected internal static ProjectionDefinitionConverters.ToChronicle(Contracts.Projections.ProjectionDefinition, ProjectionOwner) returning Concepts.Projections.Definitions.ProjectionDefinition. Review the package pin and fixtures.");
        }
        return method;
    }

    public static void SmokeTest() => _ = GetConverter();

    public static KernelDefinition Convert(ContractDefinition wire) =>
        (KernelDefinition)(GetConverter().Invoke(null, [wire, ProjectionOwner.Client]) ?? throw new InvalidOperationException("Projection converter returned null."));
}
