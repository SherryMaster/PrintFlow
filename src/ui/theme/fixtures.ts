import { pilotShopSettings } from "./branding";
import { resolveShopTheme } from "./theme";

export const okPrintsFixtureTheme = resolveShopTheme({
  name: "OkPrints",
  settings: pilotShopSettings(7),
}).theme;
