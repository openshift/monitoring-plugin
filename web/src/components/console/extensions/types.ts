type ExtensionFlags = Partial<{
  required: string[];
  disallowed: string[];
}>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type Extension<P extends {} = any> = {
  type: string;
  properties: P;
  flags?: ExtensionFlags;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type ExtensionDeclaration<T extends string, P extends {}> = Extension<P> & {
  type: T;
};

export type CodeRef<T = any> = () => Promise<T>;
