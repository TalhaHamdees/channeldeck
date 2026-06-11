import { isConfigured, missingEnvVars } from "@/lib/config";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isConfigured()) redirect("/");
  const missing = missingEnvVars();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Almost there — configuration needed</CardTitle>
          <CardDescription>
            The app is running but some environment variables are missing.
            Follow <code className="font-mono">SETUP.md</code> in the project
            root for click-by-click instructions, then restart the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm font-medium">Missing variables:</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((v) => (
              <Badge key={v} variant="destructive" className="font-mono">
                {v}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
