// Utilitaires cryptographiques — HMAC-SHA256 pour signature alerte détresse
// Implémentation pure JS (pas de dépendance native) compatible Hermes/Expo

const SHARED_SECRET = 'KmerFret_AlertSecret_2024';

// Convertit une chaîne en tableau d'octets (UTF-8 simplifié, ASCII suffisant ici)
function toBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

// SHA-256 pur JS (FIPS 180-4)
function sha256(data: number[]): number[] {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  // Padding
  const len = data.length;
  data.push(0x80);
  while (data.length % 64 !== 56) data.push(0);
  const bitLen = len * 8;
  for (let i = 7; i >= 0; i--) data.push((bitLen / Math.pow(2, i * 8)) & 0xff);

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < data.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++)
      w[j] = (data[i+j*4]<<24)|(data[i+j*4+1]<<16)|(data[i+j*4+2]<<8)|data[i+j*4+3];
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15],7) ^ rotr(w[j-15],18) ^ (w[j-15]>>>3);
      const s1 = rotr(w[j-2],17) ^ rotr(w[j-2],19)  ^ (w[j-2]>>>10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let j = 0; j < 64; j++) {
      const S1  = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch  = (e & f) ^ (~e & g);
      const tmp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0  = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const tmp2 = (S0 + maj) >>> 0;
      [h,g,f,e,d,c,b,a] = [g,f,e,(d+tmp1)>>>0,c,b,a,(tmp1+tmp2)>>>0];
    }
    h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
    h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
  }

  const out: number[] = [];
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(v => {
    for (let i = 3; i >= 0; i--) out.push((v >> (i*8)) & 0xff);
  });
  return out;
}

function hmacSha256(message: string, key: string): string {
  const blockSize = 64;
  let keyBytes = toBytes(key);
  if (keyBytes.length > blockSize) keyBytes = sha256(keyBytes);
  while (keyBytes.length < blockSize) keyBytes.push(0);

  const oKeyPad = keyBytes.map(b => b ^ 0x5c);
  const iKeyPad = keyBytes.map(b => b ^ 0x36);

  const inner = sha256([...iKeyPad, ...toBytes(message)]);
  const result = sha256([...oKeyPad, ...inner]);
  return result.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function signAlertPayload(payload: string): string {
  return hmacSha256(payload, SHARED_SECRET);
}

export function buildAlertMessage(
  userId: string,
  lat: number,
  lng: number,
  missionId?: string
): string {
  const timestamp = Date.now().toString();
  const data = `${userId}|${lat.toFixed(6)}|${lng.toFixed(6)}|${timestamp}`;
  const sig = signAlertPayload(data);
  const mission = missionId ? `|${missionId}` : '';
  return `KMERFRET_ALERT|${data}${mission}|${sig.slice(0, 16)}`;
}
