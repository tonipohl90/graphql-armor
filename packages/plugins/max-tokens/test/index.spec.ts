import { assertSingleExecutionValue, createTestkit } from '@envelop/testing';
import { describe, expect, it, jest } from '@jest/globals';
import { buildSchema } from 'graphql';

import { maxTokenDefaultOptions, maxTokensPlugin } from '../src/index';

const schema = buildSchema(/* GraphQL */ `
  type Query {
    a: String
  }
`);

describe('global', () => {
  it('should be defined', () => {
    expect(maxTokensPlugin).toBeDefined();

    maxTokensPlugin();
    maxTokensPlugin({});
    maxTokensPlugin({ n: 1 });
  });

  it('rejects an operation with more than the default max token count', async () => {
    const operation = `{ ${Array(maxTokenDefaultOptions.n).join('a ')} }`;
    const testkit = createTestkit([maxTokensPlugin()], schema);
    const result = await testkit.execute(operation);
    assertSingleExecutionValue(result);
    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toEqual(`Syntax Error: Token limit of ${maxTokenDefaultOptions.n} exceeded.`);
  });
  it('does not reject an operation below the max token count', async () => {
    const operation = `{ ${Array(maxTokenDefaultOptions.n - 2).join('a ')} }`;
    const testkit = createTestkit([maxTokensPlugin()], schema);
    const result = await testkit.execute(operation);
    assertSingleExecutionValue(result);
    expect(result.errors).toBeUndefined();
  });
  it('rejects an operation with more than the default max token count (user provided)', async () => {
    const count = 4;
    const operation = `{ ${Array(count).join('a ')} }`;
    const onReject = jest.fn();
    const testkit = createTestkit([maxTokensPlugin({ n: count, onReject: [onReject] })], schema);
    const result = await testkit.execute(operation);
    assertSingleExecutionValue(result);
    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toEqual('Syntax Error: Token limit of 4 exceeded.');
    expect(onReject).toHaveBeenCalledTimes(1);
  });
  it('does not reject an operation below the max token count (user provided)', async () => {
    const count = 4;
    const operation = `{ ${Array(count - 2).join('a ')} }`;
    const testkit = createTestkit([maxTokensPlugin({ n: count })], schema);
    const result = await testkit.execute(operation);
    assertSingleExecutionValue(result);
    expect(result.errors).toBeUndefined();
  });
  it('calls the onReject only once when finishParsing is requested', async () => {
    const count = 4;
    const operation = `{ ${Array(count).join('a ')} }`;
    const onReject = jest.fn();
    const testkit = createTestkit([maxTokensPlugin({ n: count, onReject: [onReject], finishParsing: true })], schema);
    const result = await testkit.execute(operation);
    assertSingleExecutionValue(result);
    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
  it('calls the onAccept only once when finishParsing is requested', async () => {
    const count = 4;
    const operation = `{ ${Array(count - 2).join('a ')} }`;
    const onAccept = jest.fn();
    const testkit = createTestkit([maxTokensPlugin({ n: count, onAccept: [onAccept], finishParsing: true })], schema);
    const result = await testkit.execute(operation);
    assertSingleExecutionValue(result);
    expect(result.errors).toBeUndefined();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});
