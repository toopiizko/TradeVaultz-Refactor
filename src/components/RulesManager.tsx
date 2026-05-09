import { useState } from "react";
import { useCategorizeRules } from "@/hooks/useCategorizeRules";
import { useCategoriesDB } from "@/hooks/useCategoriesDB";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

export function RulesManager({ trigger }: { trigger?: React.ReactNode }) {
  const { rules, add, remove } = useCategorizeRules();
  const { income, expense } = useCategoriesDB();
  const [open, setOpen] = useState(false);
  const [matchType, setMatchType] = useState<"keyword" | "account">("keyword");
  const [pattern, setPattern] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Food");
  const [busy, setBusy] = useState(false);

  const cats = txType === "income" ? income : expense;

  const handleAdd = async () => {
    if (!pattern.trim()) return toast.error("Pattern required");
    setBusy(true);
    try {
      await add({ match_type: matchType, pattern: pattern.trim(), category, transaction_type: txType, priority: 0 });
      toast.success("Rule added");
      setPattern("");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Rules</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Auto-categorize Rules
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 border border-border/40 rounded-lg p-3 bg-secondary/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Match by</Label>
              <Select value={matchType} onValueChange={(v: any) => setMatchType(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Keyword in description</SelectItem>
                  <SelectItem value="account">Account / number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={txType} onValueChange={(v: any) => { setTxType(v); setCategory(v === "income" ? income[0] : expense[0]); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">{matchType === "keyword" ? "Keyword" : "Account / digits"}</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={matchType === "keyword" ? "e.g. 7-eleven, grab, starbucks" : "e.g. 1234 or company name"}
            />
          </div>
          <div>
            <Label className="text-xs">→ Set category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={busy} className="w-full gap-2" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
            <Plus className="h-4 w-4" /> Add Rule
          </Button>
        </div>

        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
          {rules.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">
              No rules yet. Rules apply automatically when you import a statement.
            </p>
          )}
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 text-xs">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.transaction_type === "income" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {r.transaction_type === "income" ? "IN" : "OUT"}
              </span>
              <span className="text-muted-foreground">{r.match_type === "keyword" ? "kw" : "acct"}:</span>
              <span className="font-mono font-medium truncate flex-1">{r.pattern}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold">{r.category}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
