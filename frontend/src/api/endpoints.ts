import { apiRequest } from "./client";
import type {
  LoginResponse,
  MenuTreeNode,
  Paginated,
  RoleDetail,
  RoleOption,
  SafeMenu,
  SafeModule,
  SafePermission,
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
  switchRole(roleId: string, refreshToken?: string | null) {
    return apiRequest<SelectRoleResponse>("/api/auth/switch-role", {
      method: "POST",
      body: {
        roleId,
        ...(refreshToken ? { refreshToken } : {}),
      },
    });
  },
  myRoles() {
    return apiRequest<{ roles: RoleOption[]; activeRoleId: string }>("/api/auth/my-roles");
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
  list(params?: { moduleId?: string; limit?: number }) {
    const query = new URLSearchParams();
    query.set("limit", String(params?.limit ?? 100));
    if (params?.moduleId) query.set("moduleId", params.moduleId);
    return apiRequest<Paginated<SafeMenu>>(`/api/menus?${query.toString()}`);
  },
  create(input: {
    nombre: string;
    url?: string | null;
    moduleId: string;
    parentId?: string | null;
    orden?: number;
    icono?: string | null;
  }) {
    return apiRequest<SafeMenu>("/api/menus", {
      method: "POST",
      body: input,
    });
  },
  remove(id: string) {
    return apiRequest<SafeMenu>(`/api/menus/${id}`, { method: "DELETE" });
  },
};

export const usersApi = {
  list() {
    return apiRequest<Paginated<SafeUser>>("/api/users?limit=100");
  },
  create(input: { nombre: string; email: string; password: string }) {
    return apiRequest<SafeUser>("/api/users", {
      method: "POST",
      body: input,
    });
  },
};

export const rolesApi = {
  list() {
    return apiRequest<Paginated<SafeRole>>("/api/roles?limit=100");
  },
  get(id: string) {
    return apiRequest<RoleDetail>(`/api/roles/${id}`);
  },
  create(input: { nombre: string; descripcion?: string }) {
    return apiRequest<SafeRole>("/api/roles", {
      method: "POST",
      body: input,
    });
  },
  remove(id: string) {
    return apiRequest<SafeRole>(`/api/roles/${id}`, { method: "DELETE" });
  },
  assignUser(roleId: string, userId: string) {
    return apiRequest<{ success: true }>(`/api/roles/${roleId}/users`, {
      method: "POST",
      body: { userId },
    });
  },
  removeUser(roleId: string, userId: string) {
    return apiRequest<{ success: true }>(`/api/roles/${roleId}/users/${userId}`, {
      method: "DELETE",
    });
  },
  assignPermission(roleId: string, permissionId: string) {
    return apiRequest<{ success: true }>(`/api/roles/${roleId}/permissions`, {
      method: "POST",
      body: { permissionId },
    });
  },
  removePermission(roleId: string, permissionId: string) {
    return apiRequest<{ success: true }>(`/api/roles/${roleId}/permissions/${permissionId}`, {
      method: "DELETE",
    });
  },
  assignModule(roleId: string, moduleId: string) {
    return apiRequest<{ success: true }>(`/api/roles/${roleId}/modules`, {
      method: "POST",
      body: { moduleId },
    });
  },
  assignMenu(roleId: string, menuId: string) {
    return apiRequest<{ success: true }>(`/api/roles/${roleId}/menus`, {
      method: "POST",
      body: { menuId },
    });
  },
};

export const permissionsApi = {
  list() {
    return apiRequest<{ data: SafePermission[] }>("/api/permissions");
  },
  create(input: { codigo: string; descripcion?: string }) {
    return apiRequest<SafePermission>("/api/permissions", {
      method: "POST",
      body: input,
    });
  },
};

export const modulesApi = {
  list() {
    return apiRequest<Paginated<SafeModule>>("/api/modules?limit=100");
  },
  create(input: {
    nombre: string;
    descripcion?: string;
    baseUrl?: string | null;
    healthPath?: string | null;
  }) {
    return apiRequest<SafeModule>("/api/modules", {
      method: "POST",
      body: input,
    });
  },
  update(
    id: string,
    input: {
      nombre?: string;
      descripcion?: string | null;
      baseUrl?: string | null;
      healthPath?: string | null;
    },
  ) {
    return apiRequest<SafeModule>(`/api/modules/${id}`, {
      method: "PUT",
      body: input,
    });
  },
  remove(id: string) {
    return apiRequest<SafeModule>(`/api/modules/${id}`, { method: "DELETE" });
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
