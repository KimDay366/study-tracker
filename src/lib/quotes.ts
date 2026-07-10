export interface Quote {
  text: string;
  source: string;
}

/**
 * 내장 명언 100개 — 저작권 만료(고전) / 공개 출처 / 속담 / 미상.
 * 오늘의 명언은 날짜로 순환하며, 같은 명언은 최소 QUOTES.length(=100)일 뒤에 다시 나온다.
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
  { text: '실패는 성공의 어머니다.', source: '속담' },
  { text: '우물을 파도 한 우물을 파라.', source: '속담' },
  { text: '하늘은 스스로 돕는 자를 돕는다.', source: '미상' },
  { text: '뜻이 있는 곳에 길이 있다.', source: '미상' },
  { text: '티끌 모아 태산.', source: '속담' },
  { text: '가랑비에 옷 젖는 줄 모른다.', source: '속담' },
  { text: '급할수록 돌아가라.', source: '속담' },
  { text: '물방울이 바위를 뚫는다.', source: '미상' },
  { text: '천 마디 말보다 한 번의 실천이 낫다.', source: '미상' },
  { text: '오늘 걷지 않으면 내일은 뛰어야 한다.', source: '미상' },
  { text: '큰일은 작은 일이 쌓여 이루어진다.', source: '노자' },
  { text: '아는 것을 안다 하고 모르는 것을 모른다 하는 것, 그것이 아는 것이다.', source: '공자' },
  { text: '배우고 때때로 익히면 즐겁지 아니한가.', source: '공자' },
  { text: '세 사람이 길을 가면 그중 반드시 내 스승이 있다.', source: '공자' },
  { text: '지나침은 미치지 못함과 같다.', source: '공자' },
  { text: '스스로 돌이켜 부끄러움이 없다면 두려울 것이 없다.', source: '맹자' },
  { text: '하루라도 책을 읽지 않으면 입에 가시가 돋는다.', source: '안중근' },
  { text: '습관은 제2의 천성이다.', source: '키케로' },
  { text: '인생은 짧고 배움의 길은 길다.', source: '히포크라테스' },
  { text: '자신을 이기는 것이 가장 큰 승리다.', source: '플라톤' },
  { text: '앎은 행함으로 완성된다.', source: '미상' },
  { text: '계획 없는 목표는 한낱 소망일 뿐이다.', source: '미상' },
  { text: '길이 없으면 길을 만들어라.', source: '미상' },
  { text: '넘어지는 것은 부끄러움이 아니다, 일어서지 않는 것이 부끄러움이다.', source: '미상' },
  { text: '지금 이 순간이 내 인생에서 가장 젊은 때다.', source: '미상' },
  { text: '남과 비교하지 말고 어제의 나와 비교하라.', source: '미상' },
  { text: '작심삼일이라도 다시 시작하면 된다.', source: '미상' },
  { text: '느려도 방향이 옳다면 결국 도착한다.', source: '미상' },
  { text: '재능은 시작이고 꾸준함은 완성이다.', source: '미상' },
  { text: '쉬어가도 괜찮다, 포기만 하지 않으면.', source: '미상' },
  { text: '큰 산도 한 삽부터 옮긴다.', source: '미상' },
  { text: '오늘 심은 씨앗이 내일의 숲이 된다.', source: '미상' },
  { text: '근면은 행운의 어머니다.', source: '미상' },
  { text: '게으름은 달콤해 보이나 괴로움을 남긴다.', source: '미상' },
  { text: '실수를 두려워 말라, 아무것도 하지 않는 것이 진짜 실수다.', source: '미상' },
  { text: '위대한 일은 결코 쉽게 오지 않는다.', source: '미상' },
  { text: '끝까지 해내는 힘이 진짜 실력이다.', source: '미상' },
  { text: '오늘의 한 페이지가 내일의 한 권이 된다.', source: '미상' },
  { text: '결심은 순간이지만 습관은 평생이다.', source: '미상' },
  { text: '자신을 믿는 것이 모든 일의 첫걸음이다.', source: '미상' },
  { text: '꿈의 크기가 곧 노력의 크기다.', source: '미상' },
  { text: '멈추지 않는 한 당신은 나아가고 있다.', source: '미상' },
  { text: '오늘 하루도 나를 위한 한 걸음.', source: '미상' },
  { text: '시간은 가장 값진 재산이다.', source: '미상' },
  { text: '시간을 잘 쓰는 사람이 인생을 잘 산다.', source: '미상' },
  { text: '작은 도끼도 여러 번 치면 큰 나무를 넘어뜨린다.', source: '미상' },
  { text: '오를 수 없는 나무는 없다, 오르려 하지 않을 뿐.', source: '미상' },
  { text: '배움에는 나이가 없다.', source: '미상' },
  { text: '아는 것에서 그치지 말고 실천하라.', source: '미상' },
  { text: '목표를 적는 순간 꿈은 계획이 된다.', source: '미상' },
  { text: '매일의 습관이 미래를 만든다.', source: '미상' },
  { text: '실력은 하루아침에 생기지 않는다.', source: '미상' },
  { text: '노력에 우연한 성공은 없다.', source: '미상' },
  { text: '오늘 최선을 다한 하루는 헛되지 않는다.', source: '미상' },
  { text: '꾸준함 앞에 못 넘을 벽은 없다.', source: '미상' },
  { text: '강물은 쉬지 않고 흘러 바다에 이른다.', source: '미상' },
  { text: '흐르는 물은 썩지 않는다.', source: '속담' },
  { text: '백 번 듣는 것이 한 번 보는 것만 못하다.', source: '미상' },
  { text: '지혜로운 사람은 들을수록 더 배우려 한다.', source: '미상' },
  { text: '가장 큰 위험은 아무 위험도 감수하지 않는 것이다.', source: '미상' },
  { text: '준비된 하루가 기회를 부른다.', source: '미상' },
  { text: '오늘의 땀은 거짓말하지 않는다.', source: '미상' },
  { text: '한 걸음이라도 매일 나아가라.', source: '미상' },
  { text: '배움은 어둠을 밝히는 등불이다.', source: '미상' },
  { text: '더 나은 내일은 오늘 만들어진다.', source: '미상' },
  { text: '넘어져도 다시 일어서면 그것이 성공이다.', source: '미상' },
  { text: '오늘 하지 않으면 내일도 하지 않는다.', source: '미상' },
  { text: '오늘 아낀 한 시간이 내일의 여유가 된다.', source: '미상' },
  { text: '작은 성취가 큰 자신감을 만든다.', source: '미상' },
  { text: '나를 성장시키는 것은 결국 오늘의 나다.', source: '미상' },
];

/**
 * 인덱스 범위 내 랜덤 명언 하나 선택
 */
export function getRandomQuote(): { quote: Quote; index: number } {
  const index = Math.floor(Math.random() * QUOTES.length);
  return { quote: QUOTES[index], index };
}

/**
 * 오늘의 명언 인덱스 — 하루 단위로 고정되고, 목록 전체를 한 바퀴 도는 데 QUOTES.length일이 걸린다.
 *
 * 연속된 '에폭 일수'(1970-01-01 이후 경과 일수)를 쓰므로 연말/연초 경계에서도 간격이 보장된다
 * → 같은 명언은 최소 QUOTES.length일(현재 100일) 뒤에 다시 나온다.
 * QUOTES.length(100)와 서로소인 stride(47)를 곱해 날마다 순서가 뒤섞여 보이게 한다.
 */
export function getDailyQuoteIndex(dateStr: string): number {
  const dayNumber = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 86_400_000);
  const n = QUOTES.length;
  return (((dayNumber * 47) % n) + n) % n;
}

/** 주어진 로컬 날짜(YYYY-MM-DD)의 오늘의 명언. */
export function getDailyQuote(dateStr: string): Quote {
  return QUOTES[getDailyQuoteIndex(dateStr)];
}
