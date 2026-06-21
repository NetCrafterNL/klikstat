export function downloadCSV(filename, rows, columns) {
  const escape = val => {
    const s = String(val ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => c.label).join(',')
  const lines  = rows.map(r => columns.map(c => escape(r[c.key])).join(','))
  const csv    = [header, ...lines].join('\n')
  const blob   = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
