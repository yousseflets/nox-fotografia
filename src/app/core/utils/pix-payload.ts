/** Gera payload EMV do Pix (copia e cola) com valor. */
export function buildPixPayload(input: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountReais: number;
  txid: string;
}): string {
  const pixKey = input.pixKey.trim();
  const name = sanitizePixText(input.merchantName, 25);
  const city = sanitizePixText(input.merchantCity, 15);
  const txid = sanitizePixTxid(input.txid);
  const amount = input.amountReais.toFixed(2);

  const gui = field('00', 'br.gov.bcb.pix');
  const key = field('01', pixKey);
  const merchantAccount = field('26', gui + key);

  let payload =
    field('00', '01') +
    merchantAccount +
    field('52', '0000') +
    field('53', '986') +
    field('54', amount) +
    field('58', 'BR') +
    field('59', name) +
    field('60', city) +
    field('62', field('05', txid));

  payload += '6304';
  return payload + crc16(payload);
}

function field(id: string, value: string): string {
  const size = value.length.toString().padStart(2, '0');
  return `${id}${size}${value}`;
}

function sanitizePixText(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, max);
}

function sanitizePixTxid(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  return clean || 'NOXFOTOS';
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
