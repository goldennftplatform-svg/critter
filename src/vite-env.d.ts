/// <reference types="vite/client" />

export {}

type SolanaProvider = {
  isPhantom?: boolean
  isSolflare?: boolean
  isRobinhood?: boolean
  publicKey?: { toString(): string }
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>
  signMessage: (msg: Uint8Array, enc?: string) => Promise<{ signature: Uint8Array } | Uint8Array>
  signAndSendTransaction: (tx: unknown) => Promise<{ signature: string }>
}

declare global {
  interface Window {
    Buffer?: typeof import('buffer').Buffer
    solana?: SolanaProvider
    solflare?: SolanaProvider
    phantom?: { solana?: SolanaProvider }
    robinhood?: { solana?: SolanaProvider }
  }
}
