import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    refetchInterval: 10_000,
  });

  const profile = data?.profile;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Profile not found</CardTitle>
            <CardDescription>We couldn't load your profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signOut} variant="outline">Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // is_approved gate is driven by the DB. The super owner trigger guarantees
  // muhammadokasha216@gmail.com is always is_approved=true & is_admin=true.
  if (!profile.is_approved) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <Card className="max-w-md w-full border-amber-500/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Awaiting approval</CardTitle>
              <Badge variant="outline" className="text-amber-500 border-amber-500/40">
                {profile.account_status}
              </Badge>
            </div>
            <CardDescription>
              Your account ({profile.email}) is pending approval. You'll get access as soon
              as an admin reviews it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline">Refresh</Button>
            <Button onClick={signOut} variant="ghost">Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ARES</h1>
            <p className="text-xs text-muted-foreground">
              {profile.display_name || profile.email} · {profile.role}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profile.is_admin && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <Button onClick={signOut} variant="ghost" size="sm">Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {profile.display_name || profile.email}</CardTitle>
            <CardDescription>
              You're signed in as <span className="font-mono">{profile.email}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
            <Stat label="Role" value={profile.role} />
            <Stat label="Status" value={profile.account_status} />
            <Stat label="Subscription" value={profile.subscription_status} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

