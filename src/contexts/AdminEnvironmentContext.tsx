import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AdminUserProfile, EnvironmentId } from "@/services/environmentContext";
import {
  configureRuntimeContext,
  getPersistedAdminEnvironment,
  persistAdminEnvironment,
} from "@/services/environmentContext";

interface AdminEnvironmentValue {
  profile: AdminUserProfile;
  environmentId: EnvironmentId;
  selectEnvironment: (environmentId: EnvironmentId) => void;
}

const AdminEnvironmentContext = createContext<AdminEnvironmentValue | null>(null);

export function AdminEnvironmentProvider({ profile, children }: { profile: AdminUserProfile; children: ReactNode }) {
  const [environmentId, setEnvironmentId] = useState<EnvironmentId>(() => {
    const initial = getPersistedAdminEnvironment(profile.default_environment_id, profile.user_id);
    configureRuntimeContext({ profile, requestedEnvironment: initial });
    return initial;
  });

  const value = useMemo<AdminEnvironmentValue>(() => ({
    profile,
    environmentId,
    selectEnvironment(next) {
      persistAdminEnvironment(next, profile.user_id);
      setEnvironmentId(next);
      // Admin tabs own independent bootstrap caches. A reload guarantees every
      // tab starts from the selected namespace and avoids cross-context bleed.
      window.location.reload();
    },
  }), [environmentId, profile]);

  return <AdminEnvironmentContext.Provider value={value}>{children}</AdminEnvironmentContext.Provider>;
}

// The provider and its paired hook intentionally share this small module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminEnvironment(): AdminEnvironmentValue {
  const value = useContext(AdminEnvironmentContext);
  if (!value) throw new Error("useAdminEnvironment must be used inside AdminEnvironmentProvider");
  return value;
}
