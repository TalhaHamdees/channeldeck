"use client";

import { useRef } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { useRecord } from "@/lib/store";
import { download, parseImport, toJSON, toMarkdown } from "@/lib/storage";
import { todayKey } from "@/lib/date";
import { Button } from "@/components/ui/button";

export function DataTools() {
  const { state, replaceState } = useRecord();
  const fileRef = useRef<HTMLInputElement>(null);

  function exportJSON() {
    download(`mori-record-${todayKey()}.json`, toJSON(state), "application/json");
  }

  function exportMarkdown() {
    download(
      `mori-record-${todayKey()}.md`,
      toMarkdown(state),
      "text/markdown",
    );
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseImport(text);
    if (!parsed) {
      window.alert("That file isn't a Mori export. Nothing was changed.");
    } else if (
      window.confirm(
        `Import ${parsed.entries.length} entr${parsed.entries.length === 1 ? "y" : "ies"}? This replaces the record currently on this device.`,
      )
    ) {
      replaceState(parsed);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={exportJSON}>
        <Download className="size-4" /> JSON
      </Button>
      <Button variant="outline" size="sm" onClick={exportMarkdown}>
        <FileText className="size-4" /> Markdown
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="size-4" /> Import
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />
    </div>
  );
}
