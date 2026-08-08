const addr = '66W7hThTvatdN7mgMT5ZAaCbpuMb7Uskun4bAfteQM5F'

const rpc = (method, params) =>
  fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }).then((r) => r.json())

const masters = await fetch(
  `https://mine.critters.quest/api/masters?owner=${addr}`,
).then((r) => r.json())

for (const a of masters.assets || []) {
  const list = a.attributes?.attributeList || []
  const get = (k) => list.find((x) => x.key === k)?.value
  const asset = await rpc('getAsset', [a.publicKey])
  const attrs = asset.result?.content?.metadata?.attributes || []
  const getM = (k) =>
    attrs.find((x) => String(x.trait_type).toLowerCase() === k.toLowerCase())
      ?.value
  const json = await fetch(a.uri)
    .then((r) => r.json())
    .catch(() => null)
  const jAttrs = json?.attributes || []
  const getJ = (k) =>
    jAttrs.find((x) => String(x.trait_type).toLowerCase() === k.toLowerCase())
      ?.value

  const interesting = [...attrs, ...jAttrs].filter((x) =>
    /spin|mint|pfp|edition|bps|wedge|wheel/i.test(String(x.trait_type)),
  )

  console.log(
    JSON.stringify(
      {
        name: a.name,
        key: a.publicKey,
        edition: get('Edition'),
        editionsCount: get('Editions'),
        tokens: get('Tokens'),
        dollarMint: get('$MINT'),
        bps: getM('BPS') ?? getJ('BPS') ?? null,
        spinsUnlocked: getM('spinsUnlocked') ?? getJ('spinsUnlocked') ?? null,
        interesting,
        onChainAttrKeys: list.map((x) => x.key),
      },
      null,
      2,
    ),
  )
}
