export interface Quote {
  text: string;
  source: string;
}

/**
 * 내장 명언 30개 — 저작권 만료 / 공개 출처
 * D-6 정책: 최소 30개 필수 탑재
 */
export const QUOTES: Quote[] = [
  { text: '천 리 길도 한 걸음부터.', source: '노자' },
  { text: '배움에는 끝이 없다.', source: '공자' },
  { text: '아는 것이 힘이다.', source: '프랜시스 베이컨' },
  { text: '오늘 할 수 있는 일을 내일로 미루지 마라.', source: '벤저민 프랭클린' },
  { text: '성공은 준비된 자에게 기회가 찾아올 때 생긴다.', source: '세네카' },
  { text: '인내는 쓰고 그 열매는 달다.', source: '장자크 루소' },
  { text: '시작이 반이다.', source: '아리스토텔레스' },
  { text: '포기하지 않는 한 실패는 없다.', source: '미상' },
  { text: '노력은 배신하지 않는다.', source: '미상' },
  { text: '작은 진전도 진전이다.', source: '미상' },
  { text: '오늘의 나는 어제의 내가 만든다.', source: '미상' },
  { text: '지식은 재산보다 값지다.', source: '미상' },
  { text: '배움을 멈추는 순간 성장도 멈춘다.', source: '미상' },
  { text: '습관이 인격을 만든다.', source: '아리스토텔레스' },
  { text: '최선의 투자는 자기 자신에 대한 투자다.', source: '벤저민 프랭클린' },
  { text: '책을 읽는 사람은 책을 읽지 않는 사람에 비해 더 많이 산다.', source: '미상' },
  { text: '교육은 미래를 향한 여권이다.', source: '말콤 엑스' },
  { text: '꿈꾸는 자만이 꿈을 이룬다.', source: '미상' },
  { text: '매일 조금씩 나아지는 것, 그것이 성공의 비결이다.', source: '미상' },
  { text: '지금 흘리는 땀이 훗날의 기쁨이 된다.', source: '미상' },
  { text: '열정이 있는 곳에 길이 있다.', source: '미상' },
  { text: '천천히 가도 괜찮다. 멈추지만 않으면 된다.', source: '공자' },
  { text: '성공한 사람은 남들이 쉬는 시간에도 공부한다.', source: '미상' },
  { text: '어려울수록 더 강해진다.', source: '미상' },
  { text: '오늘의 고통은 내일의 힘이 된다.', source: '미상' },
  { text: '배움은 영원한 자산이다.', source: '미상' },
  { text: '하루하루가 쌓여 일년이 된다.', source: '미상' },
  { text: '꾸준함이 재능을 이긴다.', source: '미상' },
  { text: '더디게 가는 자가 멀리 간다.', source: '이솝' },
  { text: '오늘 최선을 다한 자에게 내일이 미소 짓는다.', source: '미상' },
];

/**
 * 인덱스 범위 내 랜덤 명언 하나 선택
 */
export function getRandomQuote(): { quote: Quote; index: number } {
  const index = Math.floor(Math.random() * QUOTES.length);
  return { quote: QUOTES[index], index };
}
