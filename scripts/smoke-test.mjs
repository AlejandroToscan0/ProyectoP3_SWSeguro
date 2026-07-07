const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const internalApiKey = process.env.INTERNAL_API_KEY;
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

if (!internalApiKey) {
  console.error("Falta INTERNAL_API_KEY en el entorno para la prueba de humo.");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

function assert(condition, message, details) {
  if (!condition) {
    console.error(`ERROR: ${message}`);
    if (details) {
      console.error("Detalles:", JSON.stringify(details, null, 2));
    }
    process.exit(1);
  }
}

async function run() {
  console.log("Iniciando prueba de humo...");

  const health = await request("/health");
  assert(health.status === 200, "Health endpoint no responde 200", health);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(login.status === 200, "Login fallido", login);
  assert(typeof login.body.tempToken === "string", "Login no retornó tempToken", login.body);
  assert(Array.isArray(login.body.roles) && login.body.roles.length > 0, "Login no retornó roles", login.body);

  const selectedRole = login.body.roles[0];
  const selectRole = await request("/api/auth/select-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken: login.body.tempToken, roleId: selectedRole.id }),
  });
  assert(selectRole.status === 200, "select-role fallido", selectRole);
  assert(typeof selectRole.body.accessToken === "string", "select-role no retornó accessToken", selectRole.body);
  assert(typeof selectRole.body.refreshToken === "string", "select-role no retornó refreshToken", selectRole.body);

  const refresh = await request("/api/auth/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: selectRole.body.refreshToken }),
  });
  assert(refresh.status === 200, "refresh-token fallido", refresh);
  assert(typeof refresh.body.accessToken === "string", "refresh-token no retornó accessToken", refresh.body);

  const validate = await request("/api/internals/validate-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": internalApiKey,
    },
    body: JSON.stringify({ token: refresh.body.accessToken }),
  });
  assert(validate.status === 200, "validate-token fallido", validate);
  assert(validate.body.active === true, "validate-token no marcó token activo", validate.body);

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: refresh.body.accessToken,
      refreshToken: refresh.body.refreshToken,
    }),
  });
  assert(logout.status === 200, "logout fallido", logout);

  const validateRevoked = await request("/api/internals/validate-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": internalApiKey,
    },
    body: JSON.stringify({ token: refresh.body.accessToken }),
  });
  assert(validateRevoked.status === 401, "token revocado debería responder 401", validateRevoked);

  console.log("Prueba de humo completada correctamente.");
}

run().catch((error) => {
  console.error("Error inesperado en prueba de humo:", error);
  process.exit(1);
});
