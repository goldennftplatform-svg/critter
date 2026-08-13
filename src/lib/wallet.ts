import { Buffer } from 'buffer'
import { Transaction } from '@solana/web3.js'
import bs58 from 'bs58'

function provider() {
  return window.phantom?.solana || window.solana || window.solflare || null
}

export function hasWallet() {
  return Boolean(provider())
}

export async function connectWallet() {
  const p = provider()
  if (!p) {
    window.open('https://phantom.app/', '_blank', 'noreferrer')
    throw new Error('Install Phantom or Solflare, then come back')
  }
  const res = await p.connect()
  return (res?.publicKey || p.publicKey)?.toString() || ''
}

export async function signDeskLogin(wallet: string, memo: string) {
  const p = provider()
  if (!p) throw new Error('Wallet not connected')
  const at = new Date().toISOString()
  const message = `Critter Three desk pass\nWallet: ${wallet}\nMemo: ${memo}\nAt: ${at}`
  const bytes = new TextEncoder().encode(message)
  const raw = await p.signMessage(bytes, 'utf8')
  const sigBytes = raw instanceof Uint8Array ? raw : raw.signature
  return { wallet, message, signature: bs58.encode(sigBytes) }
}

export async function sendPayTx(b64: string) {
  const p = provider()
  if (!p) throw new Error('Wallet not connected')
  const tx = Transaction.from(Buffer.from(b64, 'base64'))
  const sent = await p.signAndSendTransaction(tx)
  return typeof sent === 'string' ? sent : sent.signature
}
