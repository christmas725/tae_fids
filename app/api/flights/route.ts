import { NextRequest, NextResponse } from "next/server";
import { demoFlights } from "@/lib/demo";
import type { FidsFlight, FlightMode, FlightsPayload, RawKacFlight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const AIRPORT_CODE = "TAE" as const;
const DEFAULT_ENDPOINT = "https://www.airport.co.kr/daegu/ajaxf/frPryInfoSvc/getPryInfoList.do";
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
  return /^(출발|도착|departed|arrived)$/i.test(value.replace(/\s/g, ""));
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

async function fetchHomepageFlights(mode: FlightMode, date: string, formDate: string) {
  const endpoint = process.env.KAC_HOMEPAGE_API_URL?.trim() || DEFAULT_ENDPOINT;
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
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: REFERER,
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
    throw new Error("대구공항 홈페이지가 JSON이 아닌 응답을 반환했습니다.");
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
    dataSources: source === "kac_homepage" ? ["kac-daegu-homepage"] : ["demo"],
    query: { airportCode: AIRPORT_CODE, airportName: "대구", searchDate: date, searchFrom: "0000", searchTo: "2359" },
    warning,
  };
}

export async function GET(request: NextRequest) {
  const mode: FlightMode = request.nextUrl.searchParams.get("mode") === "arrivals" ? "arrivals" : "departures";
  const { date, formDate } = kstParts();

  if (process.env.FIDS_DEMO_MODE === "true") {
    return NextResponse.json(payload(mode, demoFlights(mode), "demo", "FIDS_DEMO_MODE가 활성화되어 데모 운항편을 표시합니다."));
  }

  try {
    const flights = await fetchHomepageFlights(mode, date, formDate);
    if (!flights.length) throw new Error("대구공항 운항편이 0건으로 반환되었습니다.");
    return NextResponse.json(payload(mode, flights, "kac_homepage"), {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30` },
    });
  } catch (error) {
    console.error("[TAE FIDS] 대구공항 실시간 목록 조회 실패", error);
    return NextResponse.json(
      payload(mode, demoFlights(mode), "demo", `실시간 연결 실패: ${error instanceof Error ? error.message : "Unknown error"}`),
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
