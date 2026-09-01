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

한국공항공사 대구공항 공식 출발·도착 페이지가 사용하는 실시간 목록을 서버 API Route에서 조회합니다.

- 공식 대구공항 출발: https://www.airport.co.kr/daegu/cms/frCon/index.do?CONTENTS_NO=1&MENU_ID=100
- 공식 대구공항 도착: https://www.airport.co.kr/daegu/cms/frCon/index.do?CONTENTS_NO=2&MENU_ID=100

공공데이터포털의 `한국공항공사_실시간 항공기 운항정보 검색_GW`는 편명(`schFln`)을 필수로 받는 개별 항공편 검색 API이므로, 공항 전체 FIDS 목록 소스로는 사용하지 않습니다. 현재 연동에는 API 키가 필요하지 않습니다.

기본적으로 별도 환경변수 없이 실시간 연결되며, 필요할 때만 다음 값을 사용합니다.

```env
FIDS_DEMO_MODE=false
# KAC_HOMEPAGE_API_URL=대구공항_실시간_목록_URL
```

`KAC_API_KEY`와 `KAC_FLIGHT_API_URL`은 현재 연동에서 사용하지 않으므로 Vercel에 남아 있어도 동작에 영향을 주지 않습니다.

## 실행

```bash
npm install
npm run dev
```

- 화면: http://localhost:3000
- 출발 API: http://localhost:3000/api/flights?mode=departures
- 도착 API: http://localhost:3000/api/flights?mode=arrivals

실시간 연결 성공 시 응답 `source`는 `kac_homepage`, 데모 또는 fallback은 `demo`입니다.

## 배포

Vercel에 GitHub 저장소를 연결하면 별도의 인증키 없이 배포할 수 있습니다. `FIDS_DEMO_MODE`는 `false` 또는 미설정 상태로 두고, API Route는 서울 리전(`icn1`)을 우선 사용합니다.

> `.env.local`과 실제 인증키는 GitHub에 올리지 않습니다.

## 다음 단계

1. 도착편 수하물 수취대 데이터 보조 소스 검토
2. 대구공항 홈페이지 응답 변경 감시 및 fallback 보강
3. 기존 대구공항 자동 안내방송/TTS 상태 머신 연결
