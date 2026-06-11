import { auth, signOut } from "@/auth";
import { isConfigured } from "@/lib/config";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConfigured()) redirect("/setup");
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-muted/30">
      <Nav
        signOutButton={
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        }
      />
      <main className="mx-auto max-w-6xl p-4 pb-16">{children}</main>
    </div>
  );
}
