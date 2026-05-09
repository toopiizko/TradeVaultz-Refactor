import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string | null | undefined;
  onSave: (next: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
};

/** Inline editable note: auto-saves on blur if value changed. */
export function NoteEditor({ value, onSave, placeholder = "Add a note…", className }: Props) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <Textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if ((value ?? "") !== v) onSave(v.trim()); }}
      placeholder={placeholder}
      rows={2}
      className={`text-xs resize-none ${className ?? ""}`}
    />
  );
}
