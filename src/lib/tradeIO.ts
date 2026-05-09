import * as XLSX from "xlsx";
import { Trade } from "./types";

export type TradeImportRow = {
  asset: string;
  side: "buy" | "sell";
  entry_price: number;
  exit_price: number;
  volume: number;
  pnl: number;
  strategy: string | null;
  emotion: string | null;
  note: string | null;
  trade_date: string;
};

const HEADER_MAP: Record<string, keyof TradeImportRow> = {
  asset: "asset", symbol: "asset", instrument: "asset",
  side: "side", direction: "side", type: "side",
  entry: "entry_price", entry_price: "entry_price", "entry price": "entry_price", open: "entry_price", "open price": "entry_price",
  exit: "exit_price", exit_price: "exit_price", "exit price": "exit_price", close: "exit_price", "close price": "exit_price",
  volume: "volume", lots: "volume", lot: "volume", size: "volume", qty: "volume", quantity: "volume",
  pnl: "pnl", "p&l": "pnl", profit: "pnl", "net profit": "pnl", "profit/loss": "pnl",
  strategy: "strategy", setup: "strategy",
  emotion: "emotion", mood: "emotion",
  note: "note", notes: "note", comment: "note", comments: "note",
  date: "trade_date", "trade date": "trade_date", time: "trade_date", "open time": "trade_date", "close time": "trade_date",
};

function normSide(v: any): "buy" | "sell" {
  const s = String(v ?? "").trim().toLowerCase();
  if (["sell", "short", "s"].includes(s)) return "sell";
  return "buy";
}

function parseDate(v: any): string {
  if (v == null || v === "") return new Date().toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + v * 86400000).toISOString();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function parseTradesFile(file: File): Promise<TradeImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

  return rows
    .map((raw) => {
      const out: any = { strategy: null, emotion: null, note: null };
      for (const [k, v] of Object.entries(raw)) {
        const key = HEADER_MAP[k.trim().toLowerCase()];
        if (key) out[key] = v;
      }
      if (!out.asset) return null;
      return {
        asset: String(out.asset).toUpperCase().trim(),
        side: normSide(out.side),
        entry_price: Number(out.entry_price) || 0,
        exit_price: Number(out.exit_price) || 0,
        volume: Number(out.volume) || 0,
        pnl: Number(out.pnl) || 0,
        strategy: out.strategy ? String(out.strategy) : null,
        emotion: out.emotion ? String(out.emotion) : null,
        note: out.note ? String(out.note) : null,
        trade_date: parseDate(out.trade_date),
      } as TradeImportRow;
    })
    .filter((r): r is TradeImportRow => r !== null);
}

export function exportTradesToExcel(trades: Trade[], filename = "tradevaultz-trades.xlsx") {
  const data = trades.map((t) => ({
    Date: new Date(t.trade_date).toISOString(),
    Asset: t.asset,
    Side: t.side,
    "Entry Price": Number(t.entry_price),
    "Exit Price": Number(t.exit_price),
    Volume: Number(t.volume),
    "P&L": Number(t.pnl),
    Strategy: t.strategy ?? "",
    Emotion: t.emotion ?? "",
    Note: t.note ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trades");
  XLSX.writeFile(wb, filename);
}
