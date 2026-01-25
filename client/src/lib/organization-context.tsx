import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@shared/schema";

interface OrganizationContextType {
  organization: Organization | null;
  organizationId: string;
  isLoading: boolean;
  setOrganizationId: (id: string) => void;
  refetchOrganization: () => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const DEFAULT_ORG_ID = "default-org";
const STORAGE_KEY = "debtflow_organization_id";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizationId, setOrganizationIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_ORG_ID;
    }
    return DEFAULT_ORG_ID;
  });

  const { data: organization, isLoading, refetch } = useQuery<Organization>({
    queryKey: ["/api/organizations", organizationId],
    enabled: !!organizationId,
  });

  const setOrganizationId = (id: string) => {
    setOrganizationIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, organizationId);
  }, [organizationId]);

  return (
    <OrganizationContext.Provider
      value={{
        organization: organization || null,
        organizationId,
        isLoading,
        setOrganizationId,
        refetchOrganization: refetch,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

export function getOrganizationIdHeader(organizationId: string): Record<string, string> {
  return { "X-Organization-Id": organizationId };
}
