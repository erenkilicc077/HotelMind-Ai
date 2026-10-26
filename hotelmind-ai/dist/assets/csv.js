/** RFC 4180-style CSV reader: quotes, escaped quotes, BOM, CRLF and embedded newlines. */
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, afterQuote = false;
  function pushCell() { row.push(cell); cell = ''; afterQuote = false; }
  function pushRow() { pushCell(); if (row.some(v => v.trim() !== '')) rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; afterQuote = true; } }
      else cell += ch;
    } else if (ch === '"') {
      if (cell || afterQuote) throw Error('CSV içinde hatalı tırnak işareti.');
      quoted = true;
    } else if (ch === ',') pushCell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else { if (afterQuote && ch.trim()) throw Error('CSV tırnak işaretinden sonra beklenmeyen metin.'); if (!afterQuote) cell += ch; }
  }
  if (quoted) throw Error('CSV içinde kapanmamış tırnak işareti.');
  if (cell || row.length || afterQuote) pushRow();
  return rows;
}
export function toCSV(header, rows) {
  const encode = value => { const s = String(value ?? ''); return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  return [header, ...rows].map(row => row.map(encode).join(',')).join('\r\n') + '\r\n';
}
