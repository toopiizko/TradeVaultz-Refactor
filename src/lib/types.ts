export type Trade = {
  id: string;
  user_id: string;
  portfolio_id: string | null;
  asset: string;
  side: "buy" | "sell";
  entry_price: number;
  exit_price: number;
  volume: number;
  strategy: string | null;
  emotion: string | null;
  note: string | null;
  pnl: number;
  trade_date: string;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  expense_date: string;
  created_at: string;
  updated_at: string;
};

export const POPULAR_ASSETS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
  "XAUUSD",
  "XAGUSD",
  "USOIL",
  "UKOIL",
  "BTCUSD",
  "ETHUSD",
  "US30",
  "NAS100",
  "SPX500",
  "GER40",
];

export const STRATEGIES = [
  "Breakout",
  "Trend Following",
  "Mean Reversion",
  "Scalping",
  "Swing",
  "News Trading",
  "Other",
];

export const EMOTIONS = [
  { value: "🚀", label: "Confident" },
  { value: "😎", label: "Calm" },
  { value: "🤔", label: "Uncertain" },
  { value: "😰", label: "Fearful" },
  { value: "😡", label: "Frustrated" },
  { value: "🤑", label: "Greedy" },
];

export const EXPENSE_CATEGORIES = {
  income: ["Salary", "Trading Profit", "Investment", "Freelance", "Other"],
  expense: ["Food", "Transport", "Housing", "Bills", "Shopping", "Entertainment", "Health", "Education", "Other"],
};

export function calcPnL(trade: Pick<Trade, "side" | "entry_price" | "exit_price" | "volume">): number {
  const diff = trade.side === "buy"
    ? trade.exit_price - trade.entry_price
    : trade.entry_price - trade.exit_price;
  return diff * trade.volume;
}
