import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api, authApi } from "../services/api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "super_admin" | "tenant_admin" | "staff" | "client";
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    tenantName: string;
    tenantSlug: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  setTenant: (slug: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenantState] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth on mount
    const initAuth = async () => {
      const token = localStorage.getItem("authToken");
      const savedTenant = localStorage.getItem("tenantSlug");

      if (savedTenant) {
        api.setTenant(savedTenant);
      }

      if (token) {
        try {
          const response = await authApi.getProfile();
          if (response.success && response.data) {
            setUser(response.data);

            // Connect socket if we have tenant
            if (savedTenant) {
            }
          }
        } catch (error) {
          // Token invalid, clear it
          api.setToken(null);
        }
      }

      setIsLoading(false);
    };

    initAuth();

    return () => {};
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);

    if (response.success && response.data) {
      const { user, tenant, accessToken, refreshToken } = response.data;

      api.setToken(accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      if (tenant) {
        api.setTenant(tenant.slug);
        setTenantState(tenant);
      }

      setUser(user);
    } else {
      throw response;
    }
  };

  const register = async (data: {
    tenantName: string;
    tenantSlug: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    const response = await authApi.register(data);

    if (response.success && response.data) {
      const { user, tenant, accessToken, refreshToken } = response.data as any;

      api.setToken(accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      if (tenant) {
        api.setTenant(tenant.slug);
        setTenantState(tenant);
      }

      setUser(user);
    } else {
      throw response;
    }
  };

  const logout = () => {
    api.setToken(null);
    api.setTenant(null);
    localStorage.removeItem("refreshToken");
    setUser(null);
    setTenantState(null);
  };

  const setTenant = (slug: string) => {
    api.setTenant(slug);
    // We'd need to fetch tenant info here
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        setTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
