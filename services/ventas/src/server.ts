import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Microservicio Ventas escuchando en puerto ${env.PORT}`);
  console.log(`Validación Zero Trust contra Master: ${env.MASTER_BASE_URL}`);
});
