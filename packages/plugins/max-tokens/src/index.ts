import { Plugin } from '@envelop/types';
import type { GraphQLArmorCallbackConfiguration } from '@escape.tech/graphql-armor-types';
import { GraphQLError, Source, TokenKind } from 'graphql';
import { ParseOptions, Parser } from 'graphql/language/parser';

type maxTokensParserWLexerOptions = ParseOptions & Required<MaxTokensOptions>;

export type MaxTokensOptions = { n?: number; finishParsing?: boolean } & GraphQLArmorCallbackConfiguration;
export const maxTokenDefaultOptions: Required<MaxTokensOptions> = {
  n: 1000,
  onAccept: [],
  onReject: [],
  propagateOnRejection: true,
  finishParsing: false,
};

const createTokenLimitError = (config: Required<MaxTokensOptions>, tokenCount: number) => {
  if (config.finishParsing) {
    return new GraphQLError(`Syntax Error: Token limit of ${config.n} exceeded, found ${tokenCount}`);
  }

  return new GraphQLError(`Syntax Error: Token limit of ${config.n} exceeded.`);
};

const processParsingResult = (config: Required<MaxTokensOptions>, tokenCount: number) => {
  if (tokenCount > config.n) {
    const err = createTokenLimitError(config, tokenCount);
    for (const handler of config.onReject) {
      handler(null, err);
    }
    if (config.propagateOnRejection) {
      throw err;
    }
  }

  for (const handler of config.onAccept) {
    handler(null, { n: tokenCount });
  }
};

export class MaxTokensParserWLexer extends Parser {
  private _tokenCount = 0;
  private readonly config: Required<MaxTokensOptions>;

  get tokenCount() {
    return this._tokenCount;
  }

  constructor(source: string | Source, options: maxTokensParserWLexerOptions) {
    super(source, options);

    this.config = options;

    const lexer = this._lexer;
    this._lexer = new Proxy(lexer, {
      get: (target, prop, receiver) => {
        if (prop === 'advance') {
          return () => {
            const token = target.advance();
            if (token.kind !== TokenKind.EOF) {
              this._tokenCount++;
            }

            if (!this.config.finishParsing) {
              processParsingResult(this.config, this._tokenCount);
            }
            return token;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
}

export function maxTokensPlugin(config?: MaxTokensOptions): Plugin {
  function parseWithTokenLimit(source: string | Source, options?: ParseOptions) {
    const maxTokenOptions = Object.assign({}, maxTokenDefaultOptions, config);

    const parser = new MaxTokensParserWLexer(source, Object.assign({}, options, maxTokenOptions));
    const document = parser.parseDocument();
    if (maxTokenOptions.finishParsing) {
      processParsingResult(maxTokenOptions, parser.tokenCount);
    }
    return document;
  }
  return {
    onParse({ setParseFn }) {
      setParseFn(parseWithTokenLimit);
    },
  };
}
