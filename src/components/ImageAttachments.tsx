import { useEffect, useRef, useState } from “react”;
import { Upload, X, ImageIcon, Loader2 } from “lucide-react”;
import { Button } from “@/components/ui/button”;
import { Dialog, DialogContent } from “@/components/ui/dialog”;
import { useImageUpload } from “@/hooks/useImageUpload”;

type Props = {
kind: “trade” | “expense”;
recordId: string;
paths: string[];
onChange?: (paths: string[]) => void;
compact?: boolean;
};

export function ImageAttachments({ kind, recordId, paths, onChange, compact = false }: Props) {
const { upload, remove, signedUrl, busy, MAX_PER_RECORD } = useImageUpload(kind);
const [urls, setUrls] = useState<Record<string, string>>({});
const [preview, setPreview] = useState<string | null>(null);
const fileRef = useRef<HTMLInputElement>(null);

useEffect(() => {
let cancelled = false;
(async () => {
const map: Record<string, string> = {};
for (const p of paths) {
if (urls[p]) { map[p] = urls[p]; continue; }
const u = await signedUrl(p);
if (u) map[p] = u;
}
if (!cancelled) setUrls(map);
})();
return () => { cancelled = true; };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [paths.join(”|”)]);

const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
const files = Array.from(e.target.files ?? []);
e.target.value = “”;
if (!files.length) return;
const next = await upload(recordId, files, paths);
if (next) onChange?.(next);
};

const handleRemove = async (p: string) => {
const next = await remove(recordId, p, paths);
if (next) onChange?.(next);
};

const canAdd = paths.length < MAX_PER_RECORD;
const size = compact ? “h-12 w-12” : “h-16 w-16”;

return (
<div className="space-y-2">
<div className="flex flex-wrap gap-2">
{paths.map((p) => (
<div key={p} className={`relative group rounded-md overflow-hidden border border-border ${size}`}>
{urls[p] ? (
<img
src={urls[p]}
alt=“attachment”
className=“h-full w-full object-cover cursor-pointer”
onClick={() => setPreview(urls[p])}
/>
) : (
<div className="h-full w-full flex items-center justify-center bg-secondary">
<Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
</div>
)}
<button
type=“button”
onClick={() => handleRemove(p)}
className=“absolute top-0 right-0 bg-destructive/90 text-destructive-foreground p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition”
aria-label=“Remove image”
>
<X className="h-3 w-3" />
</button>
</div>
))}
{canAdd && (
<button
type=“button”
onClick={() => fileRef.current?.click()}
disabled={busy}
className={`${size} flex items-center justify-center rounded-md border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition disabled:opacity-50`}
aria-label=“Add image”
>
{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
</button>
)}
</div>
<input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePick} />
{!compact && (
<p className="text-[10px] text-muted-foreground">
{paths.length}/{MAX_PER_RECORD} images · max 5MB each
</p>
)}

```
  <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
    <DialogContent className="max-w-3xl p-2">
      {preview && <img src={preview} alt="preview" className="w-full h-auto rounded" />}
    </DialogContent>
  </Dialog>
</div>
```

);
}

/** Tiny indicator shown in list rows (e.g. “📎 3”). */
export function ImageBadge({ count }: { count: number }) {
if (!count) return null;
return (
<span className=“inline-flex items-center gap-0.5 text-[10px] text-muted-foreground” title={`${count} image${count > 1 ? "s" : ""}`}>
<ImageIcon className="h-3 w-3" />
{count}
</span>
);
}
