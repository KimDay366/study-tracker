export function generateId(): string {
  // 1순위: secure context(HTTPS/localhost)에서만 동작
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 2순위: getRandomValues — http+IP 환경에서도 동작
  if (typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC4122 v4 필드 설정
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version = 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant = 10xx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  }

  // 3순위: 타임스탬프+난수 폴백 (충돌 위험 최소화)
  const ts = Date.now().toString(16).padStart(12, '0');
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-4${rand().slice(1)}-${(Math.floor(Math.random() * 4) + 8).toString(16)}${rand().slice(1)}-${rand()}${rand()}${rand()}`;
}
