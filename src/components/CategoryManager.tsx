import { useState } from "react";
import { useCategoriesDB } from "@/hooks/useCategoriesDB";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, X, Tag, Settings2, Cloud } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export function CategoryManager({ trigger }: { trigger?: React.ReactNode }) {
  const { income, expense, add, remove, isCustom, colorOf } = useCategoriesDB();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const ok = await add(tab, name, color);
    setBusy(false);
    if (!ok) return toast.error("Invalid or duplicate category");
    toast.success("Category added");
    setName("");
  };

  const list = tab === "expense" ? expense : income;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Categories</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Manage Categories
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
              <Cloud className="h-3 w-3" /> Synced
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>

          {(["expense", "income"] as const).map((t) => (
            <TabsContent key={t} value={t} className="space-y-3">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder={`New ${t} category…`}
                    value={tab === t ? name : ""}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                    disabled={busy}
                  />
                  <Button onClick={handleAdd} className="gap-1 shrink-0" disabled={busy} style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 max-h-[50vh] overflow-y-auto">
                {list.map((c) => {
                  const custom = isCustom(t, c);
                  const dot = colorOf(t, c);
                  return (
                    <span
                      key={c}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                        custom ? "bg-primary/10 border-primary/30 text-foreground" : "bg-secondary/60 border-border/40 text-foreground"
                      }`}
                    >
                      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
                      {c}
                      {custom ? (
                        <button onClick={() => remove(t, c)} className="hover:text-destructive" aria-label={`Remove ${c}`}>
                          <X className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">default</span>
                      )}
                    </span>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Saved to your account — works on every device.</p>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
