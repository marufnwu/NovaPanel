declare module 'node-pty' {
  interface IPty {
    onData(cb: (data: string) => void): void;
    onExit(cb: (e: { exitCode: number }) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(): void;
  }

  export function spawn(
    file: string,
    args: string[],
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
    },
  ): IPty;
}
