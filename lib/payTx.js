import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { MEMO_V2, rpcUrl } from './gate.js'

function memoIx(memo) {
  return new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_V2),
    data: Buffer.from(String(memo), 'utf8'),
  })
}

export async function buildDonateTx({ wallet, sol, to }) {
  const from = new PublicKey(wallet)
  const dest = new PublicKey(to)
  const lamports = Math.round(Number(sol) * 1e9)
  if (!(lamports >= 1_000_000 && lamports <= 5e9)) throw new Error('donate 0.001–5 SOL')
  const conn = new Connection(rpcUrl(), 'confirmed')
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
  const tx = new Transaction()
  tx.feePayer = from
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: dest, lamports }))
  tx.add(memoIx('critter-donate'))
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  return serialized.toString('base64')
}
