import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminEnvironmentProvider } from "@/contexts/AdminEnvironmentContext";
import { getAdminUserProfile, type AdminUserProfile } from "@/services/environmentContext";

interface Props {
  children: React.ReactNode;
}

export default function AdminAuthGate({ children }: Props) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkRole = async (currentSession: Session) => {
      const nextProfile = await getAdminUserProfile(currentSession.user);
      if (!mounted) return;
      setProfile(nextProfile);
      setLoading(false);
    };

    // Register listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // Defer to avoid deadlock
        setTimeout(() => void checkRole(newSession), 0);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Then read current session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        void checkRole(data.session);
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion effectuée");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Vérification des droits…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 shadow-lg text-center">
          <h1 className="text-xl font-semibold">Accès Admin</h1>
          <p className="text-sm text-muted-foreground">
            Vous devez vous connecter pour accéder au back-office.
          </p>
          <Button className="w-full" onClick={() => navigate("/auth")}>
            Aller à la page de connexion
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-lg text-center">
          <h1 className="text-xl font-semibold">Accès refusé</h1>
          <p className="text-sm text-muted-foreground">
            Le compte <strong>{session.user.email}</strong> n'a pas le rôle admin.
            Contactez un administrateur pour obtenir les droits.
          </p>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Se déconnecter
          </Button>
        </div>
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
        Déconnexion ({session.user.email})
      </Button>
      <AdminEnvironmentProvider profile={profile}>{children}</AdminEnvironmentProvider>
    </div>
  );
}
