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

공공데이터포털 데이터셋 `15158625`의 `한국공항공사_실시간 항공기 운항정보 조회_GW`를 1순위로 사용합니다.

- Base URL: `https://apis.data.go.kr/B551178/flight-status`
- FIDS 목록: `GET /info`
- 대구공항: `schAirCode=TAE`
- 출발: `schIOType=O`
- 도착: `schIOType=I`
- 시간범위: `schStTime=0000&schEdTime=2359`
- 응답: `type=json`

신규 통합 GW는 기존 실시간 운항정보 계열 API를 대체하며 `/depart`, `/arrival`, `/taxfree`, `/info`, `/detail` 기능을 제공합니다. FIDS는 공항 전체 목록을 직접 조회할 수 있는 `/info`를 사용합니다.

실시간 GW 연결 실패 시 대구공항 공식 홈페이지 실시간 목록을 보조 소스로 시도합니다.

- 공식 대구공항 출발: https://www.airport.co.kr/daegu/cms/frCon/index.do?CONTENTS_NO=1&MENU_ID=100
- 공식 대구공항 도착: https://www.airport.co.kr/daegu/cms/frCon/index.do?CONTENTS_NO=2&MENU_ID=100

별도 데이터셋 `15160195`의 `한국공항공사_실시간 항공기 운항정보 검색_GW`는 편명(`schFln`) 검색용이므로 공항 전체 FIDS 목록 소스로 사용하지 않습니다.

Vercel에는 다음 환경변수를 설정합니다.

```env
FIDS_DEMO_MODE=false
KAC_API_KEY=공공데이터포털_15158625_활용신청에_연결된_인증키
# KAC_HOMEPAGE_API_URL=대구공항_실시간_목록_URL
```

`KAC_API_KEY`는 공공데이터포털의 `15158625` 활용신청 시 선택한 서비스키와 동일해야 합니다. 기업회원은 활용신청 과정에서 `프로젝트 서비스키` 또는 `개인 서비스키`를 선택할 수 있으므로, 다른 신청에 연결된 키를 넣으면 GW가 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR (30)`을 반환할 수 있습니다.

인증키가 Encoding 형식이어도 Decoding 형식이어도 서버에서 한 번 정규화해 전달합니다. `KAC_FLIGHT_API_URL`은 사용하지 않습니다.

## 실행

```bash
npm install
npm run dev
```

- 화면: http://localhost:3000
- 출발 API: http://localhost:3000/api/flights?mode=departures
- 도착 API: http://localhost:3000/api/flights?mode=arrivals

신규 통합 GW 연결 성공 시 응답 `source`는 `kac_gw`, 홈페이지 보조 연결은 `kac_homepage`, 데모 또는 fallback은 `demo`입니다.

## 배포

Vercel에 GitHub 저장소를 연결하고 `KAC_API_KEY`를 Production과 Preview 환경에 등록합니다. `FIDS_DEMO_MODE`는 `false` 또는 미설정 상태로 두고, API Route는 서울 리전(`icn1`)을 우선 사용합니다.

> `.env.local`과 실제 인증키는 GitHub에 올리지 않습니다.

## 현재 점검 상태

- 신규 통합 GW 명세와 `/info` 호출 파라미터 확인 완료
- Preview에서 `KAC_API_KEY` 존재 및 Encoding 형태(100자) 확인
- Encoding 원문 / Decoding 후 URL 인코딩 / 재인코딩 방식 모두 시험했으나 현재 GW가 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR (30)`을 반환
- 따라서 URL·파라미터·인코딩 문제가 아니라 Vercel에 저장된 키와 `15158625` 활용신청에 연결된 서비스키가 동일한지, 활용신청 상태가 정상 완료되었는지 확인 필요

## 다음 단계

1. 공공데이터포털 `15158625` 활용신청 상세에서 선택된 서비스키와 Vercel `KAC_API_KEY` 일치 확인
2. `/info`에서 실제 대구공항 운항편 반환 확인 후 PR merge 및 Production 배포
3. 도착편 수하물 수취대가 필요하면 `/detail` 보조 결합 검토
4. 기존 대구공항 자동 안내방송/TTS 상태 머신 연결
