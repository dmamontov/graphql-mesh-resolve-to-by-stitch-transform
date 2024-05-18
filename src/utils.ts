import { Kind, type ConstObjectValueNode, type ConstValueNode } from 'graphql';

export const parseLiteral = (ast: ConstValueNode): any => {
    switch (ast.kind) {
        case Kind.STRING:
        case Kind.BOOLEAN: {
            return ast.value;
        }
        case Kind.INT:
        case Kind.FLOAT: {
            return parseFloat(ast.value);
        }
        case Kind.OBJECT: {
            return parseObject(ast);
        }
        case Kind.LIST: {
            return ast.values.map(n => parseLiteral(n));
        }
        case Kind.NULL: {
            return null;
        }
    }
};

const parseObject = (ast: ConstObjectValueNode): any => {
    const value = Object.create(null);
    ast.fields.forEach((field: any) => {
        // eslint-disable-next-line no-use-before-define
        value[field.name.value] = parseLiteral(field.value);
    });

    return value;
};
