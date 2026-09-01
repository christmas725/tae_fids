import { NextRequest, NextResponse } from "next/server";
import { demoFlights } from "@/lib/demo";
import type { FidsFlight, FlightMode, FlightsPayload, RawKacFlight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const AIRPORT_CODE = "TAE" as const;
const DEFAULT_ENDPOINT = "https://apis.data.go.kr/B551178/flight-search/getFlightStatusList";
const CACHE_SECONDS = 45;

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
  return { date: `${read("year")}${read("month")}${read("day")}` };
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

function normalizeFlight(raw: RawKacFlight, mode: FlightMode, index: number, date: string): FidsFlight {
  const departure = mode === "departures";
  const scheduleRaw = first(raw, ["scheduleDateTime", "scheduleDatetime", "scheduleTime", departure ? "std" : "sta", "std", "sta"]);
  const estimatedRaw = first(raw, ["estimatedDateTime", "estimatedDatetime", "estimatedTime", departure ? "etd" : "eta", "etd", "eta"], scheduleRaw);
  const actualRaw = first(raw, ["actualDateTime", "actualDatetime", "actualTime", departure ? "atd" : "ata", "atd", "ata"]);
  const flightId = first(raw, ["flightId", "flightID", "fln", "flightNumber"], "-").replace(/\s+/g, "");
  const airport = first(
    raw,
    departure
      ? ["airport", "arrivedKor", "arrivalAirport", "destination", "city"]
      : ["airport", "boardingKor", "departureAirport", "origin", "city"],
    "-"
  );
  const airportEnglish = first(
    raw,
    departure
      ? ["airportEnglish", "arrivedEng", "arrivalAirportEnglish", "destinationEnglish"]
      : ["airportEnglish", "boardingEng", "departureAirportEnglish", "originEnglish"]
  );
  const airportCode = first(
    raw,
    departure
      ? ["airportCode", "arrivedCode", "arrivalAirportCode", "destinationCode", "cityCode"]
      : ["airportCode", "boardingCode", "departureAirportCode", "originCode", "cityCode"]
  ).toUpperCase();
  const facility = departure
    ? first(raw, ["gate", "gateNumber", "gatenumber", "boardingGate"], "-")
    : first(raw, ["carousel", "carouselNumber", "baggageClaim", "baggage", "claim", "baggageBelt"], "-");

  return {
    id: first(raw, ["fid", "id", "flightKey"], `${mode}-${flightId}-${scheduleRaw}-${index}`),
    mode,
    flightId,
    masterFlightId: first(raw, ["masterFlightId", "masterflightid", "masterFln"]),
    airline: first(raw, ["airlineKorean", "airline", "airlineName"], "-"),
    airlineEnglish: first(raw, ["airlineEnglish", "airlineEng", "airlineNameEnglish"]),
    airport,
    airportEnglish,
    airportCode,
    scheduleDateTime: fullDateTime(scheduleRaw, date),
    estimatedDateTime: fullDateTime(estimatedRaw, date, scheduleRaw) || fullDateTime(scheduleRaw, date),
    actualDateTime: fullDateTime(actualRaw, date, scheduleRaw),
    facility,
    facilityLabel: departure ? "탑승구" : "수하물",
    flightType: normalizeType(first(raw, ["line", "lineType", "typeOfFlight", "domesticInternational"])),
    remark: first(raw, ["rmkKor", "remark", "status", "remarkKorean"]),
    remarkEnglish: first(raw, ["rmkEng", "remarkEnglish", "statusEnglish"]),
    codeshare: first(raw, ["codeshare", "codeShare", "codeShareYn"]),
  };
}

function collectArrays(value: unknown, output: RawKacFlight[][] = []): RawKacFlight[][] {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      output.push(value as RawKacFlight[]);
    }
    value.forEach((item) => collectArrays(item, output));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectArrays(item, output));
  }
  return output;
}

function extractItems(json: unknown) {
  const likely = (json as any)?.response?.body?.items?.item ?? (json as any)?.response?.body?.items ?? (json as any)?.body?.items?.item ?? (json as any)?.items?.item ?? (json as any)?.items ?? (json as any)?.data;
  if (Array.isArray(likely)) return likely as RawKacFlight[];
  if (likely && typeof likely === "object") return [likely as RawKacFlight];
  return collectArrays(json).sort((a, b) => b.length - a.length)[0] ?? [];
}

function sortEpoch(value: string) {
  return Number(value.replace(/\D/g, "").slice(0, 12)) || Number.MAX_SAFE_INTEGER;
}

async function fetchKacFlights(key: string, mode: FlightMode, date: string) {
  const endpoint = process.env.KAC_FLIGHT_API_URL?.trim() || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("schAirCode", AIRPORT_CODE);
  url.searchParams.set("schAirportCode", AIRPORT_CODE);
  url.searchParams.set("schIOType", mode === "departures" ? "O" : "I");
  url.searchParams.set("schDate", date);
  url.searchParams.set("schStTime", "0000");
  url.searchParams.set("schEdTime", "2400");
  url.searchParams.set("_type", "json");
  url.searchParams.set("type", "json");

  const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: CACHE_SECONDS } });
  const body = await response.text();
  if (!response.ok) throw new Error(`KAC GW ${response.status}: ${body.slice(0, 180)}`);
  if (body.trim().startsWith("<")) throw new Error("KAC GW가 XML을 반환했습니다. API 활용가이드의 JSON 상세기능 URL을 KAC_FLIGHT_API_URL에 입력해 주세요.");

  const json = JSON.parse(body);
  const resultCode = text((json as any)?.response?.header?.resultCode ?? (json as any)?.header?.resultCode);
  if (resultCode && !["00", "0000", "0"].includes(resultCode)) {
    throw new Error(text((json as any)?.response?.header?.resultMsg ?? (json as any)?.header?.resultMsg, `KAC GW 오류 ${resultCode}`));
  }

  const items = extractItems(json).filter((raw) => {
    const io = first(raw, ["io", "ioType", "schIOType", "arrivalDeparture"]).toLowerCase();
    if (!io) return true;
    return mode === "departures"
      ? io === "o" || io.includes("출발") || io.includes("departure")
      : io === "i" || io.includes("도착") || io.includes("arrival");
  });

  return items
    .map((raw, index) => normalizeFlight(raw, mode, index, date))
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
    dataSources: source === "kac_gw" ? ["kac-flight-search-gw"] : ["demo"],
    query: { airportCode: AIRPORT_CODE, airportName: "대구", searchDate: date, searchFrom: "0000", searchTo: "2400" },
    warning,
  };
}

export async function GET(request: NextRequest) {
  const mode: FlightMode = request.nextUrl.searchParams.get("mode") === "arrivals" ? "arrivals" : "departures";
  const { date } = kstParts();
  const key = process.env.KAC_API_KEY?.trim();
  const demoMode = process.env.FIDS_DEMO_MODE === "true" || !key;

  if (demoMode) {
    return NextResponse.json(payload(mode, demoFlights(mode), "demo", key ? undefined : "KAC_API_KEY가 없어 데모 운항편을 표시합니다."));
  }

  try {
    const flights = await fetchKacFlights(key, mode, date);
    if (!flights.length) throw new Error("대구공항 운항편이 0건으로 반환되었습니다.");
    return NextResponse.json(payload(mode, flights, "kac_gw"), { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30` } });
  } catch (error) {
    console.error("[TAE FIDS] KAC GW 조회 실패", error);
    return NextResponse.json(
      payload(mode, demoFlights(mode), "demo", `실시간 연결 실패: ${error instanceof Error ? error.message : "Unknown error"}`),
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
