import {
    type FieldNode,
    type GraphQLFieldConfig,
    type GraphQLSchema,
    type SelectionSetNode,
} from 'graphql';
import { mergeSelectionSets } from '@graphql-codegen/visitor-plugin-common';
import {
    applyRequestTransforms,
    applyResultTransforms,
    applySchemaTransforms,
} from '@graphql-mesh/utils';
import {
    type DelegationContext,
    type SubschemaConfig,
    type Transform,
} from '@graphql-tools/delegate';
import {
    parseSelectionSet,
    type ExecutionRequest,
    type ExecutionResult,
} from '@graphql-tools/utils';
import { TransformCompositeFields } from '@graphql-tools/wrap';
import { type ResolveToByStitchMap } from './types';
import { parseLiteral } from './utils';

export default class ResolveToByStitchTransform implements Transform {
    public noWrap: boolean = false;
    private readonly selectionMap: ResolveToByStitchMap[] = [];
    private readonly transformers: TransformCompositeFields[];

    constructor() {
        this.transformers = [
            new TransformCompositeFields(
                (
                    typeName: string,
                    fieldName: string,
                    fieldConfig: GraphQLFieldConfig<any, any>,
                ): GraphQLFieldConfig<any, any> =>
                    this.modifySchema(typeName, fieldName, fieldConfig) as GraphQLFieldConfig<
                        any,
                        any
                    >,
                (typeName: string, fieldName: string, fieldNode: FieldNode): FieldNode =>
                    this.modifyRequest(typeName, fieldName, fieldNode),
            ),
        ];
    }

    transformSchema(
        originalWrappingSchema: GraphQLSchema,
        subschemaConfig: SubschemaConfig,
        transformedSchema?: GraphQLSchema,
    ) {
        return applySchemaTransforms(
            originalWrappingSchema,
            // @ts-expect-error
            subschemaConfig,
            transformedSchema,
            this.transformers,
        );
    }

    public transformRequest(
        originalRequest: ExecutionRequest,
        delegationContext: DelegationContext,
        transformationContext: any,
    ): ExecutionRequest {
        return applyRequestTransforms(
            originalRequest,
            // @ts-expect-error
            delegationContext,
            transformationContext,
            this.transformers,
        );
    }

    transformResult(
        originalResult: ExecutionResult,
        delegationContext: DelegationContext,
        transformationContext: any,
    ) {
        return applyResultTransforms(
            originalResult,
            // @ts-expect-error
            delegationContext,
            transformationContext,
            this.transformers,
        );
    }

    private modifySchema(
        typeName: string,
        fieldName: string,
        fieldConfig: GraphQLFieldConfig<any, any>,
    ): any {
        if (!fieldConfig.astNode?.directives) {
            return fieldConfig;
        }

        const directives = fieldConfig.astNode.directives.filter(
            node => node.name.value === 'resolveToBy',
        );

        if (!directives.length) {
            return fieldConfig;
        }

        let selectionSet: SelectionSetNode | undefined;
        for (const directive of directives) {
            const args: Record<string, any> = {};
            for (const arg of (directive as any).arguments) {
                args[arg.name.value] = parseLiteral(arg.value);
            }

            if (!args.requiredSelectionSet && !args.keyField) {
                continue;
            }

            if (selectionSet) {
                selectionSet = mergeSelectionSets(
                    selectionSet,
                    parseSelectionSet(args.requiredSelectionSet || `{ ${args.keyField} }`),
                );
            } else {
                selectionSet = parseSelectionSet(
                    args.requiredSelectionSet || `{ ${args.keyField} }`,
                );
            }
        }

        if (selectionSet) {
            this.selectionMap.push({
                typeName,
                fieldName,
                selectionSet,
            });
        }

        return fieldConfig;
    }

    private modifyRequest(typeName: string, fieldName: string, fieldNode: FieldNode): any {
        const selectionSetMap = this.selectionMap.find(
            map => map.typeName === typeName && map.fieldName === fieldName,
        );

        if (!selectionSetMap?.selectionSet.selections) {
            return fieldNode;
        }

        return [fieldNode, ...selectionSetMap.selectionSet.selections];
    }
}
