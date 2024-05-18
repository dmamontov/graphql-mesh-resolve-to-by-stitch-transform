import { type SelectionSetNode } from 'graphql';

export interface ResolveToByStitchMap {
    typeName: string;
    fieldName: string;
    selectionSet: SelectionSetNode;
}
