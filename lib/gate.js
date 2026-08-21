/** Free access. Gate handles donate tips + optional wallet sessions. */

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export const FREE_MS = 400 * 24 * 60 * 60 * 1000
export const PREVIEW_MS = 15 * 60 * 1000

export const QUEST_MINT = 'QUESTP8xKMfot3ErcdfWXsHbG3kN9mutieAqrVNw74s'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const MEMO_V2 = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

const TICKET = 'hq_ticket'
const PAID = 'hq_paid'
const SESS = 'hq_sess'
const DEFAULT_TREASURY = '5S9tyrZwcgV127fEQMzCaBNWmEKz3iUBdASKaurBSGHU'

export function gateEnabled() {
  const flag = String(process.env.GATE_ON || '').toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'off') return false
  if (flag === '1' || flag === 'true' || flag === 'on') return true
  const name = String(process.env.VERCEL_PROJECT_NAME || '').toLowerCase()
  return name.includes('critter-three') || name.includes('critterthree')
}

export function treasury() {
  return process.env.GATE_TREASURY || DEFAULT_TREASURY
}

function secret() {
  return process.env.GATE_SECRET || 'critter-three-dev-only-set-GATE_SECRET'
}

export function rpcUrl() {
  return process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
}

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim()
  return xf || String(req.headers['x-real-ip'] || '') || req.socket?.remoteAddress || '0.0.0.0'
}

export function ipTag(ip) {
  return createHash('sha256')
    .update(`${secret()}|${ip}`)
    .digest('hex')
    .slice(0, 16)
}

function sign(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url')
  const mac = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

function unsign(token) {
  if (!token || !token.includes('.')) return null
  const i = token.lastIndexOf('.')
  const body = token.slice(0, i)
  const mac = token.slice(i + 1)
  const expect = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function readCookies(req) {
  const raw = req.headers.cookie || ''
  const out = {}
  for (const part of String(raw).split(';')) {
    const cut = part.indexOf('=')
    if (cut < 0) continue
    const k = part.slice(0, cut).trim()
    const v = part.slice(cut + 1).trim()
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

function cookieStr(name, value, maxAge) {
  const secure = process.env.VERCEL === '1' ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function addCookie(res, line) {
  const prev = res.getHeader('Set-Cookie')
  const list = prev ? (Array.isArray(prev) ? prev : [String(prev)]) : []
  list.push(line)
  res.setHeader('Set-Cookie', list)
}

function newMemo() {
  return `C3-${randomBytes(5).toString('hex')}`
}

function verifyLogin(wallet, message, signature) {
  try {
    if (!wallet || !message || !signature) return false
    if (!message.includes('Critter Three desk pass')) return false
    if (!message.includes(`Wallet: ${wallet}`)) return false
    const at = message.match(/At: (\S+)/)?.[1]
    const ts = Date.parse(at || '')
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 15 * 60 * 1000) return false
    const pubkey = bs58.decode(wallet)
    const sig = bs58.decode(signature)
    if (pubkey.length !== 32 || sig.length !== 64) return false
    return nacl.sign.detached.verify(Buffer.from(message, 'utf8'), sig, pubkey)
  } catch {
    return false
  }
}

function walletMemory() {
  const g = globalThis
  if (!g.__critterGateWallets) g.__critterGateWallets = new Map()
  return g.__critterGateWallets
}

function publicState(ticket, paid, ip, sess) {
  const now = Date.now()
  const wallet = paid?.wallet || sess?.wallet || null
  const payTo = treasury()
  if (paid?.until && paid.until > now) {
    return {
      gated: true,
      paid: true,
      free: Boolean(paid.free),
      remainingMs: 0,
      until: paid.until,
      wallet,
      treasury: payTo,
      ip: ipTag(ip),
    }
  }
  return {
    gated: true,
    paid: false,
    remainingMs: 0,
    memo: ticket?.memo || null,
    wallet,
    treasury: payTo,
    ip: ipTag(ip),
  }
}

function issueTicket(ip) {
  const now = Date.now()
  return {
    v: 1,
    ip: ipTag(ip),
    t0: now,
    previewUntil: now + PREVIEW_MS,
    memo: newMemo(),
    treasury: treasury(),
  }
}

function ipMemory() {
  const g = globalThis
  if (!g.__critterGateIps) g.__critterGateIps = new Map()
  return g.__critterGateIps
}

function bindIp(ip, ticket, paid) {
  const mem = ipMemory()
  const key = ipTag(ip)
  const prev = mem.get(key)
  if (prev) {
    ticket.t0 = prev.t0
    ticket.memo = prev.memo || ticket.memo
  }
  ticket.treasury = treasury()
  ticket.previewUntil = ticket.t0 + PREVIEW_MS
  mem.set(key, {
    t0: ticket.t0,
    previewUntil: ticket.previewUntil,
    memo: ticket.memo,
    treasury: ticket.treasury,
    paidUntil: paid?.until || prev?.paidUntil || 0,
  })
  if (!paid?.paid && prev?.paidUntil > Date.now()) {
    return { paid: true, until: prev.paidUntil, memo: prev.memo, sig: 'ip', ip: key }
  }
  return paid
}

async function ensureSession(req, res) {
  const ip = clientIp(req)
  const cookies = readCookies(req)
  let paid = unsign(cookies[PAID])
  let ticket = unsign(cookies[TICKET])
  const sess = unsign(cookies[SESS])
  if (sess?.wallet) {
    const remembered = walletMemory().get(sess.wallet)
    if (remembered?.until > Date.now() && !(paid?.until > Date.now())) {
      paid = {
        paid: true,
        until: remembered.until,
        wallet: sess.wallet,
        sig: remembered.sig,
        memo: 'wallet',
        ip: ipTag(ip),
      }
    }
  }
  if (!ticket) {
    ticket = issueTicket(ip)
  }
  paid = bindIp(ip, ticket, paid)
  addCookie(res, cookieStr(TICKET, sign(ticket), 60 * 60 * 24))
  return { ip, paid, ticket, sess }
}

function creditFree(res, ticket, ip, wallet) {
  const paid = {
    paid: true,
    free: true,
    until: Date.now() + FREE_MS,
    memo: 'free',
    sig: 'enter',
    wallet: wallet || null,
    ip: ipTag(ip),
  }
  addCookie(res, cookieStr(PAID, sign(paid), Math.floor(FREE_MS / 1000)))
  if (wallet) {
    walletMemory().set(wallet, { until: paid.until, sig: 'enter' })
    addCookie(res, cookieStr(SESS, sign({ wallet }), Math.floor(FREE_MS / 1000)))
  }
  bindIp(ip, ticket, paid)
  return paid
}

function cors(res) {
  res.setHeader('Cache-Control', 'no-store')
}

function readBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

/** Access is free. Donate is opt-in. */
export async function handleGate(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const q = req.query || {}
  const body = readBody(req)
  const action = q.action || body.action || (req.method === 'GET' ? 'status' : '')

  if (action === 'donate' && req.method !== 'GET') {
    const wallet = String(body.wallet || '').trim()
    const sol = Number(body.sol)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      res.status(400).json({ success: false, error: 'bad wallet' })
      return
    }
    if (!(sol >= 0.001 && sol <= 5)) {
      res.status(400).json({ success: false, error: 'donate 0.001–5 SOL' })
      return
    }
    const { buildDonateTx } = await import('./payTx.js')
    const tx = await buildDonateTx({ wallet, sol, to: treasury() })
    res.status(200).json({
      success: true,
      data: { tx, sol, wallet, treasury: treasury() },
    })
    return
  }

  if (!gateEnabled()) {
    res.status(200).json({
      success: true,
      data: { gated: false, paid: true, remainingMs: 0, treasury: treasury() },
    })
    return
  }
  let { ip, paid, ticket, sess } = await ensureSession(req, res)

  if (!(paid?.until > Date.now())) {
    paid = creditFree(res, ticket, ip, sess?.wallet || paid?.wallet || null)
  }

  if (action === 'logout' && req.method !== 'GET') {
    addCookie(res, cookieStr(SESS, '', 0))
    if (paid) {
      paid = { ...paid, wallet: null }
      addCookie(res, cookieStr(PAID, sign(paid), Math.floor(FREE_MS / 1000)))
    }
    sess = null
    res.status(200).json({
      success: true,
      data: { ...publicState(ticket, paid, ip, null), loggedOut: true },
    })
    return
  }

  if (action === 'login' && req.method !== 'GET') {
    const wallet = String(body.wallet || '').trim()
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      res.status(400).json({ success: false, error: 'bad wallet' })
      return
    }
    if (body.signature || body.message) {
      if (!verifyLogin(wallet, body.message, body.signature)) {
        res.status(401).json({ success: false, error: 'bad wallet signature' })
        return
      }
    }
    sess = { wallet }
    addCookie(res, cookieStr(SESS, sign(sess), Math.floor(FREE_MS / 1000)))
    paid = creditFree(res, ticket, ip, wallet)
    const remembered = walletMemory().get(wallet)
    if (remembered?.until > Date.now()) {
      paid = {
        ...paid,
        until: remembered.until,
        sig: remembered.sig,
      }
      addCookie(res, cookieStr(PAID, sign(paid), Math.floor(FREE_MS / 1000)))
    }
    res.status(200).json({
      success: true,
      data: { ...publicState(ticket, paid, ip, sess), connected: true, entered: true },
    })
    return
  }

  res.status(200).json({ success: true, data: publicState(ticket, paid, ip, sess) })
}
