/** Prompt first, then free access. Pay helpers stay for optional tips. */

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export const MIN_USD = 5
export const ACCESS_MS = 30 * 24 * 60 * 60 * 1000
export const FREE_MS = 400 * 24 * 60 * 60 * 1000
export const PREVIEW_MS = 15 * 60 * 1000
export const PREVIEW_MIN_MS = PREVIEW_MS
export const PREVIEW_MAX_MS = PREVIEW_MS
export const SLIPPAGE = 0.95

export const QUEST_MINT = 'QUESTP8xKMfot3ErcdfWXsHbG3kN9mutieAqrVNw74s'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const WSOL_MINT = 'So11111111111111111111111111111111111111112'
export const MEMO_V2 = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
export const MEMO_V1 = 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo'

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

export async function fetchPrices() {
  const [sol, quest] = await Promise.all([fetchSolUsd(), fetchQuestUsd()])
  if (!sol || !quest) throw new Error('price oracle down')
  return {
    usd: MIN_USD,
    sol,
    usdc: 1,
    quest,
    solAmt: MIN_USD / sol,
    usdcAmt: MIN_USD,
    questAmt: MIN_USD / quest,
    at: new Date().toISOString(),
    sources: { sol: 'coingecko', quest: 'dexscreener', usdc: 'peg' },
  }
}

async function fetchSolUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      cache: 'no-store',
    })
    const j = await r.json()
    const n = Number(j?.solana?.usd)
    if (n > 0) return n
  } catch {
    /* fallback */
  }
  try {
    const r = await fetch(
      'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112',
      { cache: 'no-store' },
    )
    const j = await r.json()
    const n = Number(j?.pairs?.[0]?.priceUsd)
    if (n > 0) return n
  } catch {
    /* empty */
  }
  return null
}

async function fetchQuestUsd() {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${QUEST_MINT}`, {
    cache: 'no-store',
  })
  const j = await r.json()
  const pairs = (j?.pairs || []).filter((p) => p.chainId === 'solana' && Number(p.priceUsd) > 0)
  pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
  const n = Number(pairs[0]?.priceUsd)
  return n > 0 ? n : null
}

function payUrl(treasuryAddr, amount, memo, mint = null) {
  const q = new URLSearchParams({
    amount: String(amount),
    label: 'Critter Three',
    message: '30-day Lucky Pick + Valdara desk',
    memo,
  })
  if (mint) q.set('spl-token', mint)
  return `solana:${treasuryAddr}?${q.toString()}`
}

function fmtAmt(n, digits) {
  return n.toFixed(digits).replace(/\.?0+$/, '')
}

export function quotePay(prices, treasuryAddr, memo) {
  const solAmt = Number(prices.solAmt.toFixed(6))
  const usdcAmt = Number(prices.usdcAmt.toFixed(2))
  const questAmt = Number(prices.questAmt.toFixed(4))
  return {
    memo,
    treasury: treasuryAddr,
    usd: MIN_USD,
    days: 30,
    prices: {
      sol: prices.sol,
      usdc: prices.usdc,
      quest: prices.quest,
      at: prices.at,
      sources: prices.sources,
    },
    pay: [
      {
        id: 'sol',
        symbol: 'SOL',
        amount: solAmt,
        display: `${fmtAmt(solAmt, 6)} SOL`,
        usd: MIN_USD,
        url: payUrl(treasuryAddr, solAmt, memo),
      },
      {
        id: 'usdc',
        symbol: 'USDC',
        amount: usdcAmt,
        display: `${fmtAmt(usdcAmt, 2)} USDC`,
        usd: MIN_USD,
        url: payUrl(treasuryAddr, usdcAmt, memo, USDC_MINT),
      },
      {
        id: 'quest',
        symbol: 'QUEST',
        amount: questAmt,
        display: `${fmtAmt(questAmt, 4)} QUEST`,
        usd: MIN_USD,
        url: payUrl(treasuryAddr, questAmt, memo, QUEST_MINT),
      },
    ],
  }
}

function newMemo() {
  return `C3-${randomBytes(5).toString('hex')}`
}

function previewWindow() {
  return PREVIEW_MS
}

async function rpc(method, params) {
  const res = await fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  return res.json()
}

function pubkeyOf(k) {
  if (!k) return ''
  if (typeof k === 'string') return k
  return k.pubkey || k.toString?.() || ''
}

function extractMemo(tx) {
  const ix = [
    ...(tx?.transaction?.message?.instructions || []),
    ...((tx?.meta?.innerInstructions || []).flatMap((x) => x.instructions || [])),
  ]
  for (const i of ix) {
    const pid = i.programId || ''
    if (pid !== MEMO_V2 && pid !== MEMO_V1 && i.program !== 'spl-memo') continue
    if (typeof i.parsed === 'string') return i.parsed
    if (i.parsed?.info?.memo) return String(i.parsed.info.memo)
    if (typeof i.data === 'string') {
      try {
        return Buffer.from(i.data, 'base64').toString('utf8')
      } catch {
        return i.data
      }
    }
  }
  return ''
}

function received(tx, treasuryAddr) {
  const keys = (tx?.transaction?.message?.accountKeys || []).map(pubkeyOf)
  const idx = keys.findIndex((k) => k === treasuryAddr)
  let sol = 0
  if (idx >= 0) {
    sol = ((tx.meta?.postBalances?.[idx] || 0) - (tx.meta?.preBalances?.[idx] || 0)) / 1e9
  }
  const tokens = {}
  const posts = tx?.meta?.postTokenBalances || []
  const pres = tx?.meta?.preTokenBalances || []
  for (const post of posts) {
    if (post.owner !== treasuryAddr) continue
    const pre = pres.find((p) => p.accountIndex === post.accountIndex)
    const delta =
      Number(post.uiTokenAmount?.uiAmount || 0) - Number(pre?.uiTokenAmount?.uiAmount || 0)
    if (delta > 0) tokens[post.mint] = (tokens[post.mint] || 0) + delta
  }
  return { sol, tokens }
}

function coversQuote(got, ticket) {
  const q = ticket.quotes || {}
  if (got.sol >= (q.solAmt || 0) * SLIPPAGE) return { ok: true, asset: 'SOL', amount: got.sol }
  const usdc = got.tokens[USDC_MINT] || 0
  if (usdc >= (q.usdcAmt || MIN_USD) * SLIPPAGE) return { ok: true, asset: 'USDC', amount: usdc }
  const quest = got.tokens[QUEST_MINT] || 0
  if (quest >= (q.questAmt || 0) * SLIPPAGE) return { ok: true, asset: 'QUEST', amount: quest }
  return { ok: false }
}

function coversUsd(got, quotes) {
  const q = quotes || {}
  const usd =
    got.sol * (q.sol || 0) +
    (got.tokens[USDC_MINT] || 0) * (q.usdc || 1) +
    (got.tokens[QUEST_MINT] || 0) * (q.quest || 0)
  return usd >= MIN_USD * SLIPPAGE
}

function txSigner(tx) {
  const keys = tx?.transaction?.message?.accountKeys || []
  const k = keys[0]
  if (k && typeof k === 'object') return k.pubkey || pubkeyOf(k)
  return pubkeyOf(k)
}

function txAgeOk(tx) {
  const t = Number(tx?.blockTime || 0) * 1000
  if (!t) return true
  return Date.now() - t < ACCESS_MS
}

async function loadTx(sig) {
  const j = await rpc('getTransaction', [
    sig,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
  ])
  return j.result || null
}

async function findPayment(ticket, pastedSig, wallet) {
  const payTo = ticket.treasury || treasury()
  const sigs = []
  if (pastedSig) sigs.push(String(pastedSig).trim())
  if (wallet) {
    const fromW = await rpc('getSignaturesForAddress', [wallet, { limit: 40 }])
    for (const s of fromW.result || []) {
      if (s.signature) sigs.push(s.signature)
    }
  }
  const recent = await rpc('getSignaturesForAddress', [payTo, { limit: 20 }])
  for (const s of recent.result || []) {
    if (s.signature) sigs.push(s.signature)
  }
  const seen = new Set()
  for (const sig of sigs) {
    if (!sig || seen.has(sig)) continue
    seen.add(sig)
    const tx = await loadTx(sig)
    if (!tx || tx.meta?.err) continue
    const signer = txSigner(tx)
    const fromWallet = Boolean(wallet && signer === wallet)
    if (wallet && !fromWallet && sig !== String(pastedSig || '').trim()) continue
    if (fromWallet && !txAgeOk(tx) && sig !== String(pastedSig || '').trim()) continue
    const memo = extractMemo(tx)
    if (!fromWallet) {
      if (memo && ticket.memo && !memo.includes(ticket.memo)) continue
      if (!memo && sig !== String(pastedSig || '').trim()) continue
    }
    const got = received(tx, payTo)
    const cover = coversQuote(got, ticket)
    if (cover.ok || coversUsd(got, ticket.quotes)) {
      return { sig, asset: cover.asset || 'mix', amount: cover.amount || 0, memo, wallet: signer }
    }
  }
  return null
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

function issueTicket(ip, prices) {
  const now = Date.now()
  const previewMs = previewWindow()
  return {
    v: 1,
    ip: ipTag(ip),
    t0: now,
    previewUntil: now + previewMs,
    memo: newMemo(),
    treasury: treasury(),
    quotes: prices
      ? {
          sol: prices.sol,
          quest: prices.quest,
          solAmt: prices.solAmt,
          usdcAmt: prices.usdcAmt,
          questAmt: prices.questAmt,
          at: prices.at,
          sources: prices.sources,
        }
      : null,
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
    ticket.quotes = prev.quotes || ticket.quotes
  }
  ticket.treasury = treasury()
  ticket.previewUntil = ticket.t0 + PREVIEW_MS
  mem.set(key, {
    t0: ticket.t0,
    previewUntil: ticket.previewUntil,
    memo: ticket.memo,
    quotes: ticket.quotes,
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
    ticket = issueTicket(ip, null)
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

function creditPass(res, ticket, ip, hit) {
  const paid = {
    paid: true,
    until: Date.now() + ACCESS_MS,
    memo: ticket.memo,
    sig: hit.sig,
    asset: hit.asset,
    wallet: hit.wallet || null,
    ip: ipTag(ip),
  }
  addCookie(res, cookieStr(PAID, sign(paid), Math.floor(ACCESS_MS / 1000)))
  if (hit.wallet) {
    walletMemory().set(hit.wallet, { until: paid.until, sig: hit.sig })
    addCookie(res, cookieStr(SESS, sign({ wallet: hit.wallet }), Math.floor(ACCESS_MS / 1000)))
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
export async function protect(_req, res) {
  if (!gateEnabled()) return false
  cors(res)
  return false
}

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

  const bypass = process.env.GATE_BYPASS
  if (bypass && (q.bypass === bypass || body.bypass === bypass)) {
    paid = { paid: true, until: Date.now() + ACCESS_MS, memo: 'bypass', sig: 'bypass', ip: ipTag(ip) }
    addCookie(res, cookieStr(PAID, sign(paid), Math.floor(ACCESS_MS / 1000)))
    bindIp(ip, ticket, paid)
  }

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

  if (action === 'enter' && req.method !== 'GET') {
    paid = creditFree(res, ticket, ip, sess?.wallet || body.wallet || null)
    res.status(200).json({
      success: true,
      data: { ...publicState(ticket, paid, ip, sess), entered: true },
    })
    return
  }

  if (action === 'prices' || (req.method === 'GET' && q.prices === '1')) {
    const prices = await fetchPrices()
    res.status(200).json({ success: true, data: quotePay(prices, treasury(), ticket?.memo || 'preview') })
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

  if (action === 'paytx' && req.method !== 'GET') {
    const wallet = body.wallet || sess?.wallet
    const asset = String(body.asset || 'sol').toLowerCase()
    if (!wallet) {
      res.status(400).json({ success: false, error: 'connect wallet first' })
      return
    }
    if (!['sol', 'usdc', 'quest'].includes(asset)) {
      res.status(400).json({ success: false, error: 'asset must be sol, usdc, or quest' })
      return
    }
    const { buildPayTx } = await import('./payTx.js')
    const tx = await buildPayTx({ wallet, asset, ticket })
    res.status(200).json({
      success: true,
      data: { ...publicState(ticket, paid, ip, sess), tx, asset, wallet },
    })
    return
  }

  if ((action === 'confirm' || body.sig) && req.method !== 'GET') {
    const wallet = body.wallet || sess?.wallet || paid?.wallet || null
    const hit = await findPayment(ticket, body.sig || q.sig, wallet)
    if (!hit) {
      res.status(200).json({
        success: true,
        data: { ...publicState(ticket, paid, ip, sess), waiting: true, wallet },
      })
      return
    }
    paid = creditPass(res, ticket, ip, hit)
    res.status(200).json({
      success: true,
      data: { ...publicState(ticket, paid, ip, sess), credited: true, sig: hit.sig, asset: hit.asset },
    })
    return
  }

  res.status(200).json({ success: true, data: publicState(ticket, paid, ip, sess) })
}
