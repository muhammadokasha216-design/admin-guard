import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listProfiles, setApproval, updateProfile } from "@/lib/admin.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SUPER_OWNER_EMAIL = "muhammadokasha216@gmail.com";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · ARES" }] }),
  component: AdminDashboard,
});

type Profile = Awaited<ReturnType<typeof listProfiles>>["profiles"][number];

function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMyProfile);
  const fetchList = useServerFn(listProfiles);
  const approveFn = useServerFn(setApproval);
  const updateFn = useServerFn(updateProfile);

  const meQ = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchMe() });
  const me = meQ.data?.profile;

  const listQ = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: () => fetchList(),
    enabled: !!me?.is_admin,
  });

  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);

  const approveMut = useMutation({
    mutationFn: (vars: { user_id: string; approve: boolean }) =>
      approveFn({ data: vars }),
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "User approved" : "User revoked");
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (meQ.isLoading) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }
  if (!me?.is_admin) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <Button onClick={() => navigate({ to: "/" })} variant="outline">
            Back home
          </Button>
        </div>
      </div>
    );
  }

  const profiles = listQ.data?.profiles ?? [];
  const filtered = profiles.filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      p.email.toLowerCase().includes(q) ||
      (p.display_name ?? "").toLowerCase().includes(q) ||
      (p.team ?? "").toLowerCase().includes(q)
    );
  });

  const pendingCount = profiles.filter((p) => !p.is_approved).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              {profiles.length} users · {pendingCount} pending
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">← Back</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter by email, name, or team…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-profiles"] })}
          >
            Refresh
          </Button>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {!listQ.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users.</TableCell></TableRow>
              )}
              {filtered.map((p) => {
                const isOwner = p.email === SUPER_OWNER_EMAIL;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.email}
                      {isOwner && (
                        <Badge variant="outline" className="ml-2 border-primary/40 text-primary">
                          owner
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{p.display_name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Badge variant="secondary">{p.role}</Badge></TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          p.account_status === "active"
                            ? "border-emerald-500/40 text-emerald-500"
                            : p.account_status === "pending"
                              ? "border-amber-500/40 text-amber-500"
                              : "border-destructive/40 text-destructive"
                        }
                      >
                        {p.account_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!isOwner && !p.is_approved && (
                        <Button
                          size="sm"
                          onClick={() => approveMut.mutate({ user_id: p.user_id, approve: true })}
                          disabled={approveMut.isPending}
                        >
                          Approve
                        </Button>
                      )}
                      {!isOwner && p.is_approved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveMut.mutate({ user_id: p.user_id, approve: false })}
                          disabled={approveMut.isPending}
                        >
                          Revoke
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>

      <EditDialog
        profile={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          try {
            await updateFn({ data: { user_id: editing.user_id, patch } });
            toast.success("Profile updated");
            qc.invalidateQueries({ queryKey: ["admin-profiles"] });
            setEditing(null);
          } catch (e: any) {
            toast.error(e?.message ?? "Update failed");
          }
        }}
      />
    </div>
  );
}

function EditDialog({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile | null;
  onClose: () => void;
  onSave: (patch: Record<string, any>) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<string>("member");
  const [saving, setSaving] = useState(false);

  // sync when profile changes
  if (profile && profile.email !== email && !saving) {
    // initialize on open
    setEmail(profile.email);
    setDisplayName(profile.display_name ?? "");
    setTeam(profile.team ?? "");
    setRole(profile.role);
  }

  const isOwner = profile?.email === SUPER_OWNER_EMAIL;

  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update profile info{isOwner && " (owner privileges are locked)"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Email (profile only — does not change login)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={isOwner} />
          </div>
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Team</Label>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="super_admin">super_admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!profile) return;
              setSaving(true);
              const patch: Record<string, any> = {};
              if (!isOwner && email !== profile.email) patch.email = email;
              if (displayName !== (profile.display_name ?? "")) patch.display_name = displayName;
              if (team !== (profile.team ?? "")) patch.team = team || null;
              if (!isOwner && role !== profile.role) {
                patch.role = role;
                patch.is_admin = role === "admin" || role === "super_admin";
              }
              if (Object.keys(patch).length === 0) {
                setSaving(false);
                onClose();
                return;
              }
              await onSave(patch);
              setSaving(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
