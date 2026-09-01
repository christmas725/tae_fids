# TAE FIDS v0.1 — 대구국제공항 출발·도착 전광판

기존 ICN FIDS v0.2의 화면 운용 규칙을 이어받아 대구국제공항용으로 분리한 Next.js / PWA 프로젝트입니다.

## v0.1 구성

- 출발 / 도착 전광판 전환: 왼쪽 버튼 또는 `1·D / 2·A`
- 대구공항 코드 `TAE` 고정
- 출발: 출발시각, 항공사·편명, 목적지, 국내·국제선, 탑승구, 현황
- 도착: 도착시각, 항공사·편명, 출발지, 국내·국제선, 수하물 수취대, 현황
- 한국어 → 영어 → 목적지 현지어 순환
- 코드쉐어 편명·항공사 로고 순환
- 페이지당 15개 실제 운항, 최대 2페이지, 빈 행 고정 표시
- 60초마다 운항정보 갱신
- 출발 완료편은 실제 완료시각 기준 약 5분간 유지
- API 키가 없거나 연결에 실패하면 화면에 `데모 데이터`를 명시하고 예시편 표시
- Web + 설치형 PWA 지원

## 데이터 연결

한국공항공사 신규 공공데이터 GW를 사용합니다.

- 공식 API: https://www.data.go.kr/data/15160195/openapi.do
- 공식 대구공항 출발: https://www.airport.co.kr/daegu/cms/frCon/index.do?CONTENTS_NO=1&MENU_ID=100
- 공식 대구공항 도착: https://www.airport.co.kr/daegu/cms/frCon/index.do?CONTENTS_NO=2&MENU_ID=100

공공데이터포털에서 `한국공항공사_실시간 항공기 운항정보 검색_GW` 활용신청 후 `.env.local`을 만듭니다.

```env
KAC_API_KEY=공공데이터포털_일반인증키
KAC_FLIGHT_API_URL=https://apis.data.go.kr/B551178/flight-search/getFlightStatusList
FIDS_DEMO_MODE=false
```

공식 명세에서 확인되는 Base URL은 `apis.data.go.kr/B551178/flight-search`입니다. 세부 기능 URL이 활용가이드와 다를 경우 `KAC_FLIGHT_API_URL`만 실제 요청주소로 바꾸면 나머지 코드는 그대로 사용할 수 있습니다.

응답 정규화기는 기존 KAC 필드와 신규 GW에서 흔히 쓰는 표기를 함께 허용합니다. 예: `flightId/fln`, `std/sta`, `etd/eta`, `gate/gateNumber`, `rmkKor/remark`, `carousel/baggageClaim`.

## 실행

```bash
npm install
npm run dev
```

- 화면: http://localhost:3000
- 출발 API: http://localhost:3000/api/flights?mode=departures
- 도착 API: http://localhost:3000/api/flights?mode=arrivals

실시간 연결 성공 시 응답 `source`는 `kac_gw`, 데모 또는 fallback은 `demo`입니다.

## 배포

Vercel에 GitHub 저장소를 연결한 뒤 `KAC_API_KEY`, `KAC_FLIGHT_API_URL`, `FIDS_DEMO_MODE=false`를 환경변수로 등록합니다. API Route는 서울 리전(`icn1`)을 우선 사용합니다.

> `.env.local`과 실제 인증키는 GitHub에 올리지 않습니다.

## 다음 단계

1. 실제 신규 GW 응답으로 세부 URL과 필드명 확정
2. 대구공항 홈페이지의 탑승구·수하물 필드를 보조 소스로 병합
3. 기존 대구공항 자동 안내방송/TTS 상태 머신 연결
