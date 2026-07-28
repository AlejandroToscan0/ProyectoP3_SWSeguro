export type RoleOption = {
  id: string;
  nombre: string;
};

export type MenuTreeNode = {
  id: string;
  nombre: string;
  url: string | null;
  moduleId: string;
  parentId: string | null;
  orden: number;
  icono: string | null;
  children: MenuTreeNode[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  role: RoleOption;
  permissions: string[];
  roles?: RoleOption[];
};

export type LoginResponse = {
  tempToken: string;
  roles: RoleOption[];
};

export type SelectRoleResponse = AuthSession;

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SafeUser = {
  id: string;
  nombre: string;
  email: string;
  estado: string;
};

export type SafeRole = {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
};

export type SafeModule = {
  id: string;
  nombre: string;
  descripcion: string | null;
  baseUrl: string | null;
  healthPath: string | null;
  estado: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
};

export type SafeMenu = {
  id: string;
  nombre: string;
  url: string | null;
  moduleId: string;
  parentId: string | null;
  orden: number;
  icono: string | null;
  estado: string;
};

export type SafePermission = {
  id: string;
  codigo: string;
  descripcion: string | null;
  estado: string;
};

export type RoleDetail = SafeRole & {
  users: SafeUser[];
  permissions: Array<Pick<SafePermission, "id" | "codigo" | "descripcion">>;
  modules: Array<Pick<SafeModule, "id" | "nombre" | "descripcion">>;
  menus: Array<Pick<SafeMenu, "id" | "nombre" | "url" | "parentId" | "orden">>;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
