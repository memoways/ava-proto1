import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const STORAGE_KEY = "admin_auth_ok";
const ADMIN_USER = "game-master";
const ADMIN_PASS = "jesuisdieu";

interface Props {
  children: React.ReactNode;
}

export default function AdminAuthGate({ children }: Props) {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const ok = sessionStorage.getItem(STORAGE_KEY) === "1";
      setAuthed(ok);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (user.trim() === ADMIN_USER && pass === ADMIN_PASS) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      setAuthed(true);
      toast.success("Accès admin autorisé");
    } else {
      toast.error("Identifiants invalides");
      setPass("");
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setAuthed(false);
    setUser("");
    setPass("");
  };

  if (loading) return null;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-6 shadow-lg"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Accès Admin</h1>
            <p className="text-sm text-muted-foreground">
              Identifiez-vous pour accéder au panneau d'administration.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-user">Utilisateur</Label>
            <Input
              id="admin-user"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-pass">Mot de passe</Label>
            <Input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Se connecter
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="absolute right-3 top-3 z-50"
      >
        Déconnexion
      </Button>
      {children}
    </div>
  );
}
