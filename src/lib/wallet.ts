import { Buffer } from 'buffer'
import { Transaction } from '@solana/web3.js'

const CONNECTED_KEY = 'critter-connected-wallet'
export const WALLET_EVENT = 'critter-wallet'

type Provider = {
  isPhantom?: boolean
  isSolflare?: boolean
  isRobinhood?: boolean
  publicKey?: { toString(): string }
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } } | undefined>
  disconnect?: () => Promise<void>
  signAndSendTransaction: (tx: unknown) => Promise<{ signature: string } | string>
}

function provider(): Provider | null {
  const w = window
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana
  if (w.robinhood?.solana) return w.robinhood.solana
  if (w.solana?.isRobinhood) return w.solana
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

export function getConnectedWallet() {
  try {
    const v = localStorage.getItem(CONNECTED_KEY)
    return v && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export function setConnectedWallet(addr: string | null) {
  try {
    if (addr) localStorage.setItem(CONNECTED_KEY, addr)
    else localStorage.removeItem(CONNECTED_KEY)
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(WALLET_EVENT, { detail: addr }))
}

export async function connectWallet(opts?: { force?: boolean }) {
  const p = provider()
  if (!p) {
    window.open('https://phantom.app/', '_blank', 'noreferrer')
    throw new Error('Install Phantom, Robinhood, or Solflare, then come back')
  }
  if (!opts?.force) {
    const already = addrOf(p)
    if (already) {
      setConnectedWallet(already)
      return already
    }
    try {
      const silent = await p.connect({ onlyIfTrusted: true })
      const trusted = addrOf(p, silent)
      if (trusted) {
        setConnectedWallet(trusted)
        return trusted
      }
    } catch {
      /* first visit — fall through to a real prompt */
    }
  }
  try {
    const res = await p.connect()
    const wallet = addrOf(p, res)
    if (!wallet) throw new Error('Wallet connected but sent no address')
    setConnectedWallet(wallet)
    return wallet
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/reject|denied|cancel/i.test(msg)) throw new Error('Wallet request was rejected')
    throw new Error(msg || 'Wallet connect failed')
  }
}

export async function disconnectWallet() {
  const p = provider()
  try {
    await p?.disconnect?.()
  } catch {
    /* already dropped */
  }
  setConnectedWallet(null)
}

export async function sendPayTx(b64: string) {
  const p = provider()
  if (!p) throw new Error('Wallet not connected')
  const tx = Transaction.from(Buffer.from(b64, 'base64'))
  const sent = await p.signAndSendTransaction(tx)
  return typeof sent === 'string' ? sent : sent.signature
}
