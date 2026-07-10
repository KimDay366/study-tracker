import { describe, it, expect } from 'vitest';
import {
  detectInAppBrowser,
  inAppBrowserEscapeUrl,
} from '@/lib/inAppBrowser';

// 실제 기기에서 수집되는 대표 User-Agent 샘플
const UA = {
  kakaoAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.5',
  kakaoIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5',
  naver:
    'Mozilla/5.0 (Linux; Android 13; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.5.0)',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.5.0',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0',
  facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]',
  androidWebview:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.0.0 Mobile Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromeDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

describe('detectInAppBrowser', () => {
  it('카카오톡 인앱 브라우저를 감지한다 (Android/iOS)', () => {
    expect(detectInAppBrowser(UA.kakaoAndroid)).toBe('kakaotalk');
    expect(detectInAppBrowser(UA.kakaoIos)).toBe('kakaotalk');
  });

  it('네이버앱/라인/인스타그램/페이스북 인앱 브라우저를 감지한다', () => {
    expect(detectInAppBrowser(UA.naver)).toBe('naver');
    expect(detectInAppBrowser(UA.line)).toBe('line');
    expect(detectInAppBrowser(UA.instagram)).toBe('instagram');
    expect(detectInAppBrowser(UA.facebook)).toBe('facebook');
  });

  it('안드로이드 일반 WebView를 other로 감지한다', () => {
    expect(detectInAppBrowser(UA.androidWebview)).toBe('other');
  });

  it('일반 브라우저(Chrome/Safari)는 null을 반환한다 — 오탐 방지', () => {
    expect(detectInAppBrowser(UA.chromeAndroid)).toBeNull();
    expect(detectInAppBrowser(UA.safariIos)).toBeNull();
    expect(detectInAppBrowser(UA.chromeDesktop)).toBeNull();
  });
});

describe('inAppBrowserEscapeUrl', () => {
  const target = 'https://api.studytracker.co.kr/api/v1/auth/google';

  it('카카오톡은 openExternal 스킴으로 감싼다', () => {
    const url = inAppBrowserEscapeUrl(target, 'kakaotalk', UA.kakaoAndroid);
    expect(url).toBe(
      `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`,
    );
  });

  it('라인은 openExternalBrowser=1 쿼리를 붙인다', () => {
    const url = inAppBrowserEscapeUrl(target, 'line', UA.line);
    expect(url).toBe(`${target}?openExternalBrowser=1`);
  });

  it('안드로이드 일반 WebView는 Chrome intent 스킴을 만든다', () => {
    const url = inAppBrowserEscapeUrl(target, 'other', UA.androidWebview);
    expect(url).toContain('intent://api.studytracker.co.kr/api/v1/auth/google');
    expect(url).toContain('package=com.android.chrome');
  });

  it('iOS 인스타그램 등은 자동 탈출 불가 → null', () => {
    expect(inAppBrowserEscapeUrl(target, 'instagram', UA.instagram)).toBeNull();
  });
});
