import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";
export const preferredRegion = "icn1";

const BASE = "https://apis.data.go.kr/B551178/flight-status/info";

function decoded(value: string) {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}

function redact(body: string, keys: string[]) {
  let output = body;
  for (const key of keys) {
    if (key) output = output.split(key).join("<redacted>");
  }
  return output.replace(/\s+/g, " ").slice(0, 1200);
}

async function probe(label: string, url: string, keys: string[]) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.text();
    return {
      label,
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: redact(body, keys),
    };
  } catch (error) {
    return { label, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET() {
  const configured = process.env.KAC_API_KEY?.trim() || "";
  if (!configured) return NextResponse.json({ error: "KAC_API_KEY missing" }, { status: 500 });

  const raw = configured;
  const dec = decoded(configured);
  const common = "schAirCode=TAE&schIOType=O&schStTime=0000&schEdTime=2359&type=json";

  const viaDecodedParams = new URL(BASE);
  viaDecodedParams.searchParams.set("serviceKey", dec);
  viaDecodedParams.searchParams.set("schAirCode", "TAE");
  viaDecodedParams.searchParams.set("schIOType", "O");
  viaDecodedParams.searchParams.set("schStTime", "0000");
  viaDecodedParams.searchParams.set("schEdTime", "2359");
  viaDecodedParams.searchParams.set("type", "json");

  const exactRaw = `${BASE}?serviceKey=${raw}&${common}`;
  const encodedRaw = `${BASE}?serviceKey=${encodeURIComponent(raw)}&${common}`;

  const keys = [raw, dec, encodeURIComponent(raw), encodeURIComponent(dec)];
  const results = await Promise.all([
    probe("decoded_then_URLSearchParams", viaDecodedParams.toString(), keys),
    probe("raw_exact_query", exactRaw, keys),
    probe("raw_encodeURIComponent", encodedRaw, keys),
  ]);

  return NextResponse.json({
    keyShape: {
      length: raw.length,
      containsPercent: raw.includes("%"),
      decodedLength: dec.length,
      changedByDecode: raw !== dec,
    },
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
