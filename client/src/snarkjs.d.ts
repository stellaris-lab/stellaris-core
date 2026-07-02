declare module "snarkjs" {
  export const groth16: {
    fullProve(input: unknown, wasmFile: string, zkeyFile: string): Promise<{ proof: unknown; publicSignals: string[] }>;
    verify(vk: Record<string, unknown>, publicSignals: readonly string[], proof: unknown): Promise<boolean>;
  };
}
