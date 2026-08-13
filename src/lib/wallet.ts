import { Buffer } from 'buffer'
import { Transaction } from '@solana/web3.js'

type Provider = {
  isPhantom?: boolean
  isSolflare?: boolean
  publicKey?: { toString(): string }
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } } | undefined>
  signAndSendTransaction: (tx: unknown) => Promise<{ signature: string } | string>
}

function provider(): Provider | null {
  const w = window
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana
  if (w.solflare?.isSolflare) return w.solflare
  if (w.solana?.isPhantom) return w.solana
  if (w.solflare) return w.solflare
  if (w.solana) return w.solana
  return null
}

export function hasWallet() {
  return Boolean(provider())
}

function addrOf(p: Provider, res?: { publicKey: { toString(): string } } | null) {
  return (res?.publicKey || p.publicKey)?.toString() || ''
}

export async function connectWallet() {
  const p = provider()
  if (!p) {
    window.open('https://phantom.app/', '_blank', 'noreferrer')
    throw new Error('Install Phantom or Solflare, then come back')
  }
  const already = addrOf(p)
  if (already) return already
  try {
    const silent = await p.connect({ onlyIfTrusted: true })
    const trusted = addrOf(p, silent)
    if (trusted) return trusted
  } catch {
    /* first visit — fall through to a real prompt */
  }
  try {
    const res = await p.connect()
    const wallet = addrOf(p, res)
    if (!wallet) throw new Error('Wallet connected but sent no address')
    return wallet
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/reject|denied|cancel/i.test(msg)) throw new Error('Wallet request was rejected')
    throw new Error(msg || 'Wallet connect failed')
  }
}

export async function sendPayTx(b64: string) {
  const p = provider()
  if (!p) throw new Error('Wallet not connected')
  const tx = Transaction.from(Buffer.from(b64, 'base64'))
  const sent = await p.signAndSendTransaction(tx)
  return typeof sent === 'string' ? sent : sent.signature
}
