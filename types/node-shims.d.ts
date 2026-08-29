/**
 * Declaraciones minimas para los modulos integrados de Node que usamos.
 *
 * El registro de npm no es accesible en este entorno, asi que no se puede
 * instalar `@types/node`. En lugar de renunciar a `strict`, se declara aqui
 * exactamente la superficie que el proyecto utiliza — que es pequena: el
 * ejecutor de pruebas integrado y `assert`.
 *
 * Si en algun momento el proyecto puede instalar dependencias, basta con
 * borrar este archivo y anadir "types": ["node"] al tsconfig.
 */

declare module 'node:test' {
  export interface TestContext {
    readonly name: string;
    diagnostic(message: string): void;
    skip(message?: string): void;
    todo(message?: string): void;
  }
  type TestFn = (t: TestContext) => void | Promise<void>;
  export function test(name: string, fn: TestFn): void;
  export function test(name: string, options: object, fn: TestFn): void;
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: TestFn): void;
  export function before(fn: () => void | Promise<void>): void;
  export function after(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  interface AssertStrict {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: T, expected: T, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual<T>(actual: T, expected: T, message?: string): void;
    notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(value: string, regexp: RegExp, message?: string): void;
    doesNotMatch(value: string, regexp: RegExp, message?: string): void;
    throws(fn: () => unknown, message?: string | RegExp | object): void;
    fail(message?: string): never;
  }
  const assert: AssertStrict;
  export default assert;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string, encoding?: string): void;
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean; isFile(): boolean; size: number };
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function extname(p: string): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare const process: {
  readonly argv: string[];
  readonly env: Record<string, string | undefined>;
  readonly platform: string;
  exit(code?: number): never;
  cwd(): string;
};

declare const console: {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  table(data: unknown): void;
  group(label?: string): void;
  groupEnd(): void;
};
