export function groupSiteVersions(rows = []) {
  const list = Array.isArray(rows) ? rows : []
  return {
    manualSaves: list.filter((row) => row.source === 'manual'),
    autosaves: list.filter((row) => row.source === 'auto'),
    recoverySaves: list.filter((row) => !['manual', 'auto'].includes(row.source)),
  }
}
