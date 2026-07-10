/**
 * 인앱(In-App) 브라우저 감지 및 외부 브라우저 탈출 유틸.
 *
 * 카카오톡·네이버앱·라인·인스타그램 등에서 링크를 열면 각 앱의 내장 WebView가
 * 뜬다. 이 WebView에서 구글 OAuth를 시도하면 구글이 "보안 브라우저 사용" 정책으로
 * 막아 `403 disallowed_useragent`를 반환한다. 따라서 구글 로그인 직전에 인앱
 * 브라우저인지 감지하고, 가능하면 기기의 기본 브라우저(Chrome/Safari)로 탈출시킨다.
 */

export type InAppBrowser =
  | 'kakaotalk'
  | 'naver'
  | 'line'
  | 'instagram'
  | 'facebook'
  | 'other';

/**
 * User-Agent 문자열로 인앱 브라우저를 판별한다. 일반 브라우저면 null.
 * 기본값은 실행 환경의 navigator.userAgent (테스트에서는 인자로 주입).
 */
export function detectInAppBrowser(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): InAppBrowser | null {
  const s = ua.toLowerCase();

  if (s.includes('kakaotalk')) return 'kakaotalk';
  // 네이버앱 인앱 브라우저: "NAVER(inapp; ...)" — 네이버 웨일(Whale) 브라우저와 구분
  if (s.includes('naver(inapp')) return 'naver';
  // 라인: "Line/11.1.0" — "online" 등 오탐을 피하려 슬래시까지 확인
  if (s.includes('line/')) return 'line';
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('fban') || s.includes('fbav') || s.includes('fb_iab')) return 'facebook';
  // 그 외 안드로이드 WebView (UA에 "; wv" 표기)
  if (s.includes('; wv')) return 'other';

  return null;
}

/**
 * 인앱 브라우저에서 target URL을 기기 기본 브라우저로 열기 위한 이동용 URL을 만든다.
 * 프로그래밍적 탈출이 불가능한 경우(iOS 인스타그램/페이스북 등) null → 호출부가 안내를 노출.
 */
export function inAppBrowserEscapeUrl(
  target: string,
  browser: InAppBrowser,
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): string | null {
  // 카카오톡: 전용 스킴으로 외부 브라우저에서 열기 (iOS/Android 공통)
  if (browser === 'kakaotalk') {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`;
  }

  // 라인: openExternalBrowser=1 쿼리를 붙이면 외부 브라우저로 연다
  if (browser === 'line') {
    const sep = target.includes('?') ? '&' : '?';
    return `${target}${sep}openExternalBrowser=1`;
  }

  // 안드로이드: intent 스킴으로 Chrome 강제 실행
  if (/android/i.test(ua)) {
    try {
      const u = new URL(target);
      const scheme = u.protocol.replace(':', '');
      return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};package=com.android.chrome;end`;
    } catch {
      return null;
    }
  }

  // iOS 인스타그램/페이스북 등 — 자동 탈출 불가, 사용자 안내 필요
  return null;
}

/** 인앱 브라우저별 한국어 표시 이름 (안내 문구용) */
export function inAppBrowserLabel(browser: InAppBrowser): string {
  switch (browser) {
    case 'kakaotalk':
      return '카카오톡';
    case 'naver':
      return '네이버 앱';
    case 'line':
      return '라인';
    case 'instagram':
      return '인스타그램';
    case 'facebook':
      return '페이스북';
    default:
      return '앱 내 브라우저';
  }
}
