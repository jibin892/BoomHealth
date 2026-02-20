export const AED_SYMBOL = "AED"
const LEGACY_AED_SYMBOL = "Ð"

export function formatAedAmount(amount: string | number) {
  if (typeof amount === "number") {
    return `${AED_SYMBOL} ${amount}`
  }

  const normalized = amount
    .replaceAll("AED", "")
    .replaceAll("د.إ", "")
    .replaceAll(LEGACY_AED_SYMBOL, "")
    .replaceAll(AED_SYMBOL, "")
    .trim()

  return normalized ? `${AED_SYMBOL} ${normalized}` : AED_SYMBOL
}
