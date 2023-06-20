type ExtensionFlags = Partial<{
  required: string[];
  disallowed: string[];
}>;

export type Extension<P extends {} = any> = {
  type: string;
  properties: P;
  flags?: ExtensionFlags;
};

export type ExtensionDeclaration<T extends string, P extends {}> = Extension<P> & {
  type: T;
};

export type CodeRef<T = any> = () => Promise<T>;
