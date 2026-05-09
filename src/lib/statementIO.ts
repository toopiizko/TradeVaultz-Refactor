import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - worker entry
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ParsedTxn = {
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  expense_date: string; // YYYY-MM-DD
};

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((i: any) => i.str).join(" ");
    full += text + "\n";
  }
  return full;
}

export async function extractSheetText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  let out = "";
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    out += `# Sheet: ${name}\n${csv}\n\n`;
  }
  return out;
}

export async function extractStatementText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdfText(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) return extractSheetText(file);
  // fallback: treat as text
  return await file.text();
}

export function exportExpensesToExcel(
  rows: Array<{ expense_date: string; type: string; category: string; description: string | null; amount: number }>,
  filename = "tradevaultz-expenses.xlsx",
) {
  const data = rows.map((e) => ({
    Date: new Date(e.expense_date).toISOString().slice(0, 10),
    Type: e.type,
    Category: e.category,
    Description: e.description ?? "",
    Amount: Number(e.amount),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  XLSX.writeFile(wb, filename);
}
