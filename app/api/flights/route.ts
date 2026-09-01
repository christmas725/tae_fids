import { NextRequest, NextResponse } from "next/server";
import { demoFlights } from "@/lib/demo";
import type { FidsFlight, FlightMode, FlightsPayload, RawKacFlight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "edge";
export const preferredRegion = "icn1";

const AIRPORT_CODE = "TAE" as const;
const KAC_GW_BASE = "https://apis.data.go.kr/B551178/flight-status";
const HOMEPAGE_ENDPOINT = "https://www.airport.co.kr/daegu/ajaxf/frPryInfoSvc/getPryInfoList.do";
const REFERER = "https://www.airport.co.kr/daegu/cms/frCon/index.do?MENU_ID=100";
const CACHE_SECONDS = 45;
const REQUEST_TIMEOUT_MS = 10_000;

const text = (value: unknown, fallback = "") =>
  value === null || value === undefined ? fallback : String(value).trim();

function first(raw: RawKacFlight, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = text(raw[key]);
    if (value) return value;
  }
  return fallback;
}

function kstParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return { date: `${year}${month}${day}`, formDate: `${year}-${month}-${day}` };
}

function addDays(date: string, amount: number) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  const next = new Date(Date.UTC(y, m - 1, d + amount));
  return `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, "0")}${String(next.getUTCDate()).padStart(2, "0")}`;
}

function hhmm(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12) return digits.slice(8, 12);
  if (digits.length >= 4) return digits.slice(-4);
  return digits.padStart(4, "0");
}

function fullDateTime(value: string, date: string, scheduledValue = "") {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 12) return digits.slice(0, 12);
  const time = hhmm(value);
  if (!time) return "";
  if (time === "2400") return `${addDays(date, 1)}0000`;

  let targetDate = date;
  const scheduled = hhmm(scheduledValue);
  if (scheduled) {
    const scheduledMinutes = Number(scheduled.slice(0, 2)) * 60 + Number(scheduled.slice(2));
    const valueMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(2));
    if (valueMinutes + 720 < scheduledMinutes) targetDate = addDays(date, 1);
    if (valueMinutes - 720 > scheduledMinutes) targetDate = addDays(date, -1);
  }
  return `${targetDate}${time}`;
}

function normalizeType(value: string): "국내선" | "국제선" {
  const normalized = value.toLowerCase();
  return normalized.includes("국제") || normalized === "i" || normalized.includes("international")
    ? "국제선"
    : "국내선";
}

function isCompleteStatus(value: string) {
  return /^(출발|출발완료|도착|departed|arrived)$/i.test(value.replace(/\s/g, ""));
}

function normalizeGwInfoFlight(raw: RawKacFlight, mode: FlightMode, index: number, date: string): FidsFlight {
  const departure = mode === "departures";
  const scheduleRaw = first(raw, ["std", "STD", "scheduledatetime"]);
  const estimatedRaw = first(raw, ["etd", "ETD", "estimateddatetime"], scheduleRaw);
  const flightId = first(raw, ["airFln", "AIR_FLN", "flightid"], "-").replace(/\s+/g, "");
  const remark = first(raw, ["rmkKor", "RMK_KOR"]);
  const airportCode = first(raw, ["city", "CITY"], "").toUpperCase();

  return {
    id: `${date}-${mode}-${flightId}-${scheduleRaw}-${index}`,
    mode,
    flightId,
    masterFlightId: first(raw, ["masterflightid", "MASTER_FLN"]),
    airline: first(raw, ["airlineKorean", "AIRLINE_KOREAN", "airline"], "-"),
    airlineEnglish: first(raw, ["airlineEnglish", "AIRLINE_ENGLISH"]),
    airport: departure
      ? first(raw, ["arrivedKor", "ARRIVED_KOR", "arrAirport"], "-")
      : first(raw, ["boardingKor", "BOARDING_KOR", "depAirport"], "-"),
    airportEnglish: departure
      ? first(raw, ["arrivedEng", "ARRIVED_ENG", "arrAirportEng"])
      : first(raw, ["boardingEng", "BOARDING_ENG", "depAirportEng"]),
    airportCode,
    scheduleDateTime: fullDateTime(scheduleRaw, date),
    estimatedDateTime: fullDateTime(estimatedRaw, date, scheduleRaw) || fullDateTime(scheduleRaw, date),
    actualDateTime: isCompleteStatus(remark) ? fullDateTime(estimatedRaw, date, scheduleRaw) : "",
    facility: departure ? first(raw, ["gate", "GATE"], "-") : first(raw, ["baggageClaim", "BAGGAGE_CLAIM"], "-"),
    facilityLabel: departure ? "탑승구" : "수하물",
    flightType: normalizeType(first(raw, ["line", "LINE"])),
    remark,
    remarkEnglish: first(raw, ["rmkEng", "RMK_ENG"]),
    codeshare: first(raw, ["codeshare", "CDSR_YN"]),
  };
}

function normalizeHomepageFlight(raw: RawKacFlight, mode: FlightMode, index: number, date: string): FidsFlight {
  const departure = mode === "departures";
  const scheduleRaw = first(raw, ["STD", "std"]);
  const estimatedRaw = first(raw, ["ETD", "ETD1", "etd"], scheduleRaw);
  const flightId = first(raw, ["AIR_FLN", "airFln", "FLN", "fln"], "-").replace(/\s+/g, "");
  const remark = first(raw, ["RMK_KOR", "rmkKor"]);
  const operationDate = first(raw, ["ACT_C_DATE"], date).replace(/\D/g, "").slice(0, 8) || date;

  return {
    id: `${operationDate}-${mode}-${flightId}-${scheduleRaw}-${index}`,
    mode,
    flightId,
    masterFlightId: first(raw, ["CDSR_MST_FL_NM", "masterFln"]),
    airline: first(raw, ["AIR_KOR", "airlineKorean"], "-"),
    airlineEnglish: first(raw, ["AIR_ENG", "airlineEnglish"]),
    airport: first(raw, ["ARRIVED_KOR", "VIA_KOR", "arrivedKor"], "-"),
    airportEnglish: first(raw, ["ARRIVED_ENG", "VIA_ENG", "arrivedEng"]),
    airportCode: first(raw, ["CITY", "VIA", "city"], "").toUpperCase(),
    scheduleDateTime: fullDateTime(scheduleRaw, operationDate),
    estimatedDateTime: fullDateTime(estimatedRaw, operationDate, scheduleRaw) || fullDateTime(scheduleRaw, operationDate),
    actualDateTime: isCompleteStatus(remark) ? fullDateTime(estimatedRaw, operationDate, scheduleRaw) : "",
    facility: departure ? first(raw, ["GATE", "gate"], "-") : "-",
    facilityLabel: departure ? "탑승구" : "수하물",
    flightType: normalizeType(first(raw, ["LINE", "line"])),
    remark,
    remarkEnglish: first(raw, ["RMK_ENG", "rmkEng"]),
    codeshare: first(raw, ["CDSR_YN", "codeshare"]),
  };
}

function sortEpoch(value: string) {
  return Number(value.replace(/\D/g, "").slice(0, 12)) || Number.MAX_SAFE_INTEGER;
}

function cleanApiKey(value: string) {
  const trimmed = value.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function safeUpstreamMessage(value: string, apiKey: string) {
  return value.replaceAll(apiKey, "<redacted>").replace(/\s+/g, " ").slice(0, 220);
}

function gwItems(json: any): RawKacFlight[] {
  const response = json?.response ?? json;
  const header = response?.header ?? json?.header;
  const resultCode = text(header?.resultCode);
  if (resultCode && resultCode !== "00" && resultCode !== "0000") {
    throw new Error(`KAC 통합 운항 API 오류 ${resultCode}: ${text(header?.resultMsg, "알 수 없는 오류")}`);
  }

  const body = response?.body ?? json?.body ?? json;
  const value = body?.items?.item ?? body?.items ?? json?.items?.item ?? json?.items ?? [];
  if (Array.isArray(value)) return value as RawKacFlight[];
  return value && typeof value === "object" ? [value as RawKacFlight] : [];
}

async function fetchGwInfoFlights(mode: FlightMode, date: string) {
  const configuredKey = process.env.KAC_API_KEY;
  if (!configuredKey?.trim()) throw new Error("KAC_API_KEY가 설정되지 않았습니다.");

  const apiKey = cleanApiKey(configuredKey);
  const endpoint = new URL(`${KAC_GW_BASE}/info`);
  endpoint.searchParams.set("serviceKey", apiKey);
  endpoint.searchParams.set("schAirCode", AIRPORT_CODE);
  endpoint.searchParams.set("schIOType", mode === "departures" ? "O" : "I");
  endpoint.searchParams.set("schStTime", "0000");
  endpoint.searchParams.set("schEdTime", "2359");
  endpoint.searchParams.set("pageNo", "1");
  endpoint.searchParams.set("numOfRows", "100");
  endpoint.searchParams.set("type", "json");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(`KAC 통합 운항 API ${response.status}: ${safeUpstreamMessage(responseBody, apiKey)}`);
  }

  let json: any;
  try {
    json = JSON.parse(responseBody);
  } catch {
    throw new Error(`KAC 통합 운항 API가 JSON이 아닌 응답을 반환했습니다: ${safeUpstreamMessage(responseBody, apiKey)}`);
  }

  const expectedIo = mode === "departures" ? "O" : "I";
  return gwItems(json)
    .filter((raw) => {
      const io = first(raw, ["io", "IO"]).toUpperCase();
      const airport = first(raw, ["airport", "AIRPORT"]).toUpperCase();
      return (!io || io === expectedIo) && (!airport || airport === AIRPORT_CODE);
    })
    .map((raw, index) => normalizeGwInfoFlight(raw, mode, index, date))
    .filter((flight) => flight.flightId !== "-" && flight.scheduleDateTime)
    .sort((a, b) => sortEpoch(a.scheduleDateTime) - sortEpoch(b.scheduleDateTime) || a.flightId.localeCompare(b.flightId));
}

async function fetchHomepageFlights(mode: FlightMode, date: string, formDate: string) {
  const endpoint = process.env.KAC_HOMEPAGE_API_URL?.trim() || HOMEPAGE_ENDPOINT;
  const body = new URLSearchParams({
    pInoutGbn: mode === "departures" ? "O" : "I",
    pAirport: AIRPORT_CODE,
    pGbn: "",
    pActDate: formDate,
    pSthourMin: "00:00",
    pEnhourMin: "23:59",
    pCity: "",
    pAirline: "",
    pAirlinenum: "",
    p0: "",
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://www.airport.co.kr",
      Referer: REFERER,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const responseBody = await response.text();
  if (!response.ok) throw new Error(`대구공항 홈페이지 ${response.status}: ${responseBody.slice(0, 180)}`);

  let json: any;
  try {
    json = JSON.parse(responseBody);
  } catch {
    const contentType = response.headers.get("content-type") || "unknown";
    throw new Error(`대구공항 홈페이지가 JSON이 아닌 응답을 반환했습니다. (${contentType}: ${responseBody.replace(/\s+/g, " ").slice(0, 100)})`);
  }

  const items = Array.isArray(json?.data?.list) ? (json.data.list as RawKacFlight[]) : [];
  return items
    .filter((raw) => {
      const io = first(raw, ["IO", "io"]).toUpperCase();
      return !io || io === (mode === "departures" ? "O" : "I");
    })
    .map((raw, index) => normalizeHomepageFlight(raw, mode, index, date))
    .filter((flight) => flight.flightId !== "-" && flight.scheduleDateTime)
    .sort((a, b) => sortEpoch(a.scheduleDateTime) - sortEpoch(b.scheduleDateTime) || a.flightId.localeCompare(b.flightId));
}

function payload(mode: FlightMode, flights: FidsFlight[], source: FlightsPayload["source"], warning?: string): FlightsPayload {
  const { date } = kstParts();
  return {
    flights,
    mode,
    updatedAt: new Date().toISOString(),
    source,
    dataSources:
      source === "kac_gw"
        ? ["kac-flight-status-info-gw"]
        : source === "kac_homepage"
          ? ["kac-daegu-homepage"]
          : ["demo"],
    query: {
      airport: AIRPORT_CODE,
      date,
    },
    warning,
  };
}

export async function GET(request: NextRequest) {
  const modeParam = request.nextUrl.searchParams.get("mode");
  const mode: FlightMode = modeParam === "arrivals" ? "arrivals" : "departures";
  const { date, formDate } = kstParts();

  if (process.env.FIDS_DEMO_MODE === "true") {
    return NextResponse.json(payload(mode, demoFlights(mode), "demo", "FIDS_DEMO_MODE가 활성화되어 데모 운항편을 표시합니다."));
  }

  const liveErrors: string[] = [];

  try {
    const flights = await fetchGwInfoFlights(mode, date);
    return NextResponse.json(payload(mode, flights, "kac_gw"), {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30` },
    });
  } catch (error) {
    liveErrors.push(error instanceof Error ? error.message : "KAC GW Unknown error");
  }

  try {
    const flights = await fetchHomepageFlights(mode, date, formDate);
    if (!flights.length) throw new Error("대구공항 홈페이지 운항편이 0건으로 반환되었습니다.");
    return NextResponse.json(payload(mode, flights, "kac_homepage", liveErrors[0]), {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30` },
    });
  } catch (error) {
    liveErrors.push(error instanceof Error ? error.message : "Homepage Unknown error");
    console.error("[TAE FIDS] 대구공항 실시간 목록 조회 실패", liveErrors.join(" / "));
    return NextResponse.json(
      payload(mode, demoFlights(mode), "demo", `실시간 연결 실패: ${liveErrors.join(" / ")}`),
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
