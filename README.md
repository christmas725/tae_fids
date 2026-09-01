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

공공데이터포털 데이터셋 `15158625`의 `한국공항공사_실시간 항공기 운항정보 조회_GW`를 사용합니다.

- Base URL: `https://apis.data.go.kr/B551178/flight-status`
- 기본 FIDS 목록: `GET /info`
- 코드쉐어 보강: 출발 `GET /depart`, 도착 `GET /arrival`
- 게이트·수하물 보강: `GET /detail`
- 대구공항: `TAE`
- 응답: `type=json`

### `/info` — 기본 FIDS

- `schAirCode=TAE`
- 출발: `schIOType=O`
- 도착: `schIOType=I`
- 시간범위: `schStTime=0000&schEdTime=2359`
- 페이지: `pageNo=1&numOfRows=100`

화면에 필요한 편명, 항공사, 출·도착지, 예정/변경시간, 운항상태와 출발편 게이트를 우선 가져옵니다.

### `/depart`·`/arrival` — 코드쉐어

같은 날짜의 대구공항 전체 운항편을 조회해 `/info` 목록에 다음 메타데이터를 보강합니다.

- `codeshare`: 공동운항 여부 (`Y` / `N`)
- `masterflightid`: 실제 운항편(마스터 편명)

공동운항편은 마스터 편명 기준으로 같은 실제 운항편 그룹에 묶이며, 기존 FIDS 화면의 항공사 로고·편명 순환 기능을 사용해 한 행 안에서 순환 표시합니다. 마스터 운항편에도 동일한 마스터 ID를 부여해 판매편과 서로 다른 행으로 분리되지 않도록 처리합니다.

### `/detail` — 게이트·수하물 수취대

`/detail` 응답에는 `GATE`와 `BAGGAGE_CLAIM`이 포함됩니다. 다만 전체 공항·복수 날짜 데이터가 함께 제공되고 한 페이지 최대 100건으로 제한되므로 매 갱신마다 전체 페이지를 순회하지 않습니다.

- 게이트 또는 수하물 값이 아직 없는 운항편만 대상
- 현재 시각 기준 약 3시간 전 ~ 4시간 후의 운항편만 상세 보강
- 예정시각(`STD`)으로 상세 데이터 페이지를 이진 탐색
- 해당 페이지와 인접 페이지만 읽어 같은 시각이 페이지 경계에 걸린 경우도 대응
- 상세 페이지는 10분 캐시하여 공공데이터 API 호출량을 보호

출발편은 `/info`의 게이트를 우선 사용하고 값이 없을 때 `/detail`을 보조로 사용합니다. 도착편은 `/detail`의 `BAGGAGE_CLAIM`이 실제 배정되면 수하물 수취대 칸에 반영합니다.

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

`KAC_API_KEY`는 공공데이터포털의 `15158625` 활용신청 시 선택한 서비스키와 동일해야 합니다. 기업회원은 활용신청 과정에서 `프로젝트 서비스키` 또는 `개인 서비스키`를 선택할 수 있으므로, Vercel에도 해당 활용신청에 연결한 키를 사용해야 합니다.

인증키가 Encoding 형식이어도 Decoding 형식이어도 서버에서 한 번 정규화해 전달합니다. `KAC_FLIGHT_API_URL`은 사용하지 않습니다.

## 실행

```bash
npm install
npm run dev
```

- 화면: http://localhost:3000
- 출발 API: http://localhost:3000/api/flights?mode=departures
- 도착 API: http://localhost:3000/api/flights?mode=arrivals

신규 통합 GW 연결 성공 시 응답 `source`는 `kac_gw`, 홈페이지 보조 연결은 `kac_homepage`, 데모 또는 fallback은 `demo`입니다. `dataSources`에는 실제로 사용된 `/info`, `/depart`·`/arrival`, 필요 시 `/detail` 소스가 표시됩니다.

## 배포

Vercel에 GitHub 저장소를 연결하고 `KAC_API_KEY`를 Production과 Preview 환경에 등록합니다. `FIDS_DEMO_MODE`는 `false` 또는 미설정 상태로 둡니다. API Route는 Node.js Runtime을 사용하며 KAC 각 데이터 소스의 갱신 특성에 맞춰 서버 캐시를 적용합니다.

> `.env.local`과 실제 인증키는 GitHub에 올리지 않습니다.

## 현재 점검 상태

- 신규 통합 GW `/info`, `/depart`, `/arrival`, `/detail` 명세 확인 완료
- 공공데이터포털 `15158625` 활용승인 후 Preview 인증 정상 확인
- `/info`: 대구공항 출발 `29/29`, 도착 `29/29` 전체 운항편 수신 확인
- `/depart`·`/arrival`: `codeshare`, `masterflightid` 공식 제공 확인
- 2026-09-02 운항편은 현재 코드쉐어 `Y` 편이 0건이라 화면상 공동운항 순환 대상 없음
- `/detail`: `GATE`, `BAGGAGE_CLAIM` 공식 제공 및 실제 과거 운항편 값 확인
- `/detail`은 `numOfRows=100`까지 정상이며 그보다 큰 페이지 크기는 API 오류가 발생하므로 100건 페이지 기준으로 선택 조회
- 진단용 임시 스크립트는 최종 코드에서 제거

## 다음 단계

1. 실제 운항 시간대에 게이트·수하물 배정값이 들어오는지 운영 검증
2. 코드쉐어 운항일에 마스터편/판매편 한 행 순환 표시 운영 검증
3. 대구공항 홈페이지 응답 변경 감시 및 fallback 보강
4. 기존 대구공항 자동 안내방송/TTS 상태 머신 연결