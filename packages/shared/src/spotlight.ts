export function applySpotlight(keyPoints: string[], userName: string): string[] {
  if (!userName) return keyPoints
  const escaped = userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'gi')
  return keyPoints.map((point) => point.replace(regex, (match) => `**${match}**`))
}
