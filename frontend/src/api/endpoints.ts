import { apiRequest } from "./client";
import type {
  LoginResponse,
  MenuTreeNode,
  Paginated,
  SafeMenu,
  SafeModule,
  SafeRole,
  SafeUser,
  SelectRoleResponse,
} from "../types";

export const authApi = {
  login(email: string, password: string) {
    return apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },
  selectRole(tempToken: string, roleId: string) {
    return apiRequest<SelectRoleResponse>("/api/auth/select-role", {
      method: "POST",
      body: { tempToken, roleId },
      auth: false,
    });
  },
  logout(accessToken?: string | null, refreshToken?: string | null) {
    return apiRequest<{ success: true }>("/api/auth/logout", {
      method: "POST",
      body: {
        ...(accessToken ? { accessToken } : {}),
        ...(refreshToken ? { refreshToken } : {}),
      },
      auth: false,
      skipRefresh: true,
    });
  },
};

export const menusApi = {
  tree() {
    return apiRequest<MenuTreeNode[]>("/api/menus/tree");
  },
  list() {
    return apiRequest<Paginated<SafeMenu>>("/api/menus?limit=50");
  },
};

export const usersApi = {
  list() {
    return apiRequest<Paginated<SafeUser>>("/api/users?limit=50");
  },
};

export const rolesApi = {
  list() {
    return apiRequest<Paginated<SafeRole>>("/api/roles?limit=50");
  },
};

export const modulesApi = {
  list() {
    return apiRequest<Paginated<SafeModule>>("/api/modules?limit=50");
  },
};

export type Sale = {
  id: string;
  producto: string;
  monto: number;
  creadoPor: string;
  roleId: string;
  fechaCreacion: string;
};

export const ventasApi = {
  list() {
    return apiRequest<{ data: Sale[] }>("/api/ventas");
  },
  create(input: { producto: string; monto: number }) {
    return apiRequest<Sale>("/api/ventas", {
      method: "POST",
      body: input,
    });
  },
};
