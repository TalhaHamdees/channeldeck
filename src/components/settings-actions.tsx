"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SyncNowButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/sync/trigger", { method: "POST" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Syncing…" : "Sync now"}
    </Button>
  );
}

export function RemoveChannelButton({
  channelId,
  channelTitle,
}: {
  channelId: string;
  channelTitle: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={busy}
      onClick={async () => {
        if (
          !window.confirm(
            `Remove "${channelTitle}" and all its synced data? This also revokes the app's access to the channel.`
          )
        )
          return;
        setBusy(true);
        try {
          await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Removing…" : "Remove"}
    </Button>
  );
}
