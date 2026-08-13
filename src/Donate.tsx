export const TREASURY = '5S9tyrZwcgV127fEQMzCaBNWmEKz3iUBdASKaurBSGHU'

export function donateUrl(treasury = TREASURY) {
  const q = new URLSearchParams({
    label: 'Critter Three',
    message: 'Donation',
  })
  return `solana:${treasury}?${q.toString()}`
}

export function DonateButton({
  className,
  treasury = TREASURY,
}: {
  className?: string
  treasury?: string
}) {
  return (
    <a className={className} href={donateUrl(treasury)} title={`Send to ${treasury}`}>
      Donate
    </a>
  )
}
