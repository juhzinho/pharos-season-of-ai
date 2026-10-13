// Pharos Pacific Mainnet (chain 1672), from https://docs.pharos.xyz/getting-started/token-registry
export const TOKENS = {
  USDC: "0xc879c018db60520f4355c26ed1a6d572cdac1815",
  WPROS: "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0",
};

export function resolveToken(input) {
  if (!input) return TOKENS.USDC;
  return TOKENS[input.toUpperCase()] ?? input;
}
