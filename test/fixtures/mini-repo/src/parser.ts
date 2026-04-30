// parser.ts — expression parser
export interface ASTNode {
  type: string;
  value?: string;
  children?: ASTNode[];
}

export class Parser {
  parse(input: string): ASTNode {
    // TODO: refactor the parser to use a visitor pattern
    return this.parseExpression(input.trim());
  }

  private parseExpression(input: string): ASTNode {
    if (/^\d+$/.test(input)) return { type: 'number', value: input };
    return { type: 'identifier', value: input };
  }
}
