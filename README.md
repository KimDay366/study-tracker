# study-tracker

**Study Tracker** — 공부 시간을 기록하고 루틴과 회고를 관리하는 스터디 트래커 웹 애플리케이션의 프론트엔드입니다.

## 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| 언어/빌드 | TypeScript + Vite 6 |
| UI 라이브러리 | React 19 |
| 라우팅 | react-router-dom 7 |
| 서버 상태 | @tanstack/react-query 5 |
| 클라이언트 상태 | zustand 5 |
| HTTP 클라이언트 | axios |
| 테스트 | vitest + @testing-library/react + MSW |
| 스타일 | CSS Modules |

## 요구 사항

- Node.js 18 이상
- 백엔드 API 서버(`study-tracker-api`)가 함께 실행 중이어야 전체 기능이 동작합니다.

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env

# 3. 개발 서버 실행 (http://localhost:5173)
npm run dev

# 4. 프로덕션 빌드
npm run build

# 5. 빌드 결과 미리보기
npm run preview

# 6. 테스트
npm test          # 1회 실행
npm run test:watch  # 워치 모드
```

## 환경변수

`.env.example` 참고.

| 키 | 설명 | 기본값 |
|----|------|--------|
| `VITE_API_BASE` | 백엔드 API 베이스 URL | `http://localhost:4000/api/v1` |

## 주요 화면

| 화면 | 설명 |
|------|------|
| 로그인 / 회원가입 | 이메일 기반 인증, 구글 로그인 |
| 이메일 인증 | 가입 후 이메일 인증 처리 |
| 오늘 공부 | 타이머로 공부 시간 기록 |
| 캘린더 | 날짜별 학습 기록 확인 |
| 학습 로직 목록 / 편집 | 과목·항목 등 학습 로직 관리 |
| 루틴 | 학습 루틴 설정 |
| 주간 회고 | 주 단위 회고 작성 |
| 설정 | 사용자 설정 |

## 프로젝트 구조

```
src/
├── api/          # 서버 통신 로직 (axios)
├── assets/       # 정적 파일
├── components/   # 재사용 UI 컴포넌트 (테스트는 *.test.tsx로 동봉)
├── hooks/        # 커스텀 훅
├── lib/          # 공통 라이브러리
├── pages/        # 라우팅되는 화면 단위 컴포넌트
├── stores/       # zustand 상태 스토어
└── types/        # 타입 정의
```

## 백엔드 연동

이 앱은 `study-tracker-api` 백엔드와 함께 동작합니다.
로컬 개발 시 백엔드를 먼저 `http://localhost:4000`에 띄운 뒤 프론트를 실행하세요.
