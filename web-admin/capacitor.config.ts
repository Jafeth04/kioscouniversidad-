import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gueguense.kiosco",
  appName: "Kiosco",
  // Carpeta de la exportación estática de Next (next build -> out/)
  webDir: "out",
  android: {
    // Permite que la WebView guarde datos (sesión, cola offline) de forma persistente.
    backgroundColor: "#0C1310",
  },
};

export default config;
