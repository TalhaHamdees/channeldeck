import { getDb, schema } from "@/db";
import { getPendingJobCount, getRecentSyncRuns } from "@/lib/queries";
import { fmtNumber } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RemoveChannelButton,
  SyncNowButton,
} from "@/components/settings-actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "The sign-in link expired or was tampered with. Try again.",
  no_refresh_token:
    "Google didn't return offline access. Try connecting again.",
  missing_monetary_scope:
    "Revenue permission wasn't granted. Reconnect and check ALL permission boxes on the Google consent screen.",
  no_channel_for_account:
    "That Google account has no YouTube channel. Pick the channel's identity in Google's account chooser.",
  connect_failed: "Connection failed unexpectedly. Check server logs.",
  access_denied: "You cancelled the Google consent screen.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const db = getDb();
  const channels = await db
    .select()
    .from(schema.channels)
    .orderBy(schema.channels.sortOrder, schema.channels.title);
  const [runs, pendingJobs] = await Promise.all([
    getRecentSyncRuns(8),
    getPendingJobCount(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <div className="flex items-center gap-2">
          {pendingJobs > 0 && (
            <Badge variant="secondary">{pendingJobs} sync jobs queued</Badge>
          )}
          <SyncNowButton />
        </div>
      </div>

      {connected && (
        <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
          <CardContent className="p-4 text-sm">
            Channel connected. Up to a year of history is backfilling — charts
            fill in over the next few minutes.
          </CardContent>
        </Card>
      )}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            {ERROR_MESSAGES[error] ?? `Connection error: ${error}`}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm">Connected channels</CardTitle>
            <CardDescription>
              One Google sign-in per channel. Pick the channel&apos;s identity
              in Google&apos;s account chooser each time.
            </CardDescription>
          </div>
          {/* full page navigation (not client-side) so the redirect to Google works */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see above */}
          <a
            href="/api/channels/connect"
            className={buttonVariants({ size: "sm" })}
          >
            Add channel
          </a>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No channels yet. Click &quot;Add channel&quot; to connect your
              first one.
            </p>
          ) : (
            <ul className="divide-y">
              {channels.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {c.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="h-9 w-9 rounded-full"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.subscriberCount != null &&
                          `${fmtNumber(c.subscriberCount)} subs · `}
                        {c.lastSyncedAt
                          ? `synced ${c.lastSyncedAt.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}`
                          : "never synced"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {c.tokenStatus !== "active" ? (
                      // Full page navigation so the redirect to Google works.
                      // eslint-disable-next-line @next/next/no-html-link-for-pages
                      <a
                        href="/api/channels/connect"
                        className={buttonVariants({
                          size: "sm",
                          variant: "destructive",
                        })}
                      >
                        Reconnect
                      </a>
                    ) : !c.backfillComplete ? (
                      <Badge variant="secondary">Backfilling…</Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )}
                    <RemoveChannelButton
                      channelId={c.id}
                      channelTitle={c.title}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sync history</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No syncs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const ok = run.channels.filter(
                    (c) => c.status === "success"
                  ).length;
                  const failed = run.channels.filter(
                    (c) => c.status === "failed"
                  );
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {run.startedAt.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {run.trigger}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            run.status === "success"
                              ? "outline"
                              : run.status === "running"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ok} job{ok === 1 ? "" : "s"} ok
                        {failed.length > 0 && (
                          <span className="text-destructive">
                            {" "}
                            · {failed.length} failed (
                            {failed[0].errorMessage?.slice(0, 80) ?? "error"}
                            {failed.length > 1 ? ", …" : ""})
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
