import React, { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { StudioShell } from "../components/StudioShell";
import { useMe } from "../lib/hooks";
import { CurrentUser } from "../lib/types";

export interface StudioLayoutContext {
  me: CurrentUser | null;
  meLoading: boolean;
  meError: Error | null;
  refetchMe: () => void;
}

export const StudioLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { me, loading: meLoading, error: meError, refetch: refetchMe } = useMe();

  const pathname = location.pathname;

  const normalizedPath = pathname.startsWith("/studio/tasks/")
    ? "/studio/tasks"
    : pathname.startsWith("/studio/clients/")
    ? "/studio/clients"
    : pathname;
  const canManageAdmins = useMemo(
    () => Boolean(me && (me.role === "ADMIN" || me.isSuperAdmin)),
    [me]
  );

  return (
    <StudioShell
      currentRoute={normalizedPath}
      canManageAdmins={canManageAdmins}
      onNavigate={(route) => navigate(route)}
    >
      <Outlet context={{ me, meLoading, meError, refetchMe }} />
    </StudioShell>
  );
};
