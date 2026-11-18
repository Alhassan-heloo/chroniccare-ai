import { arCatalog } from "./locales/ar";
import { enCatalog } from "./locales/en";

/** The standalone homepage uses the same catalog labels as application routes. */
export const brandLabels = {
  ar: {
    home: arCatalog.common.navigation.home,
    signIn: arCatalog.auth.signIn,
    register: arCatalog.auth.register,
    assistant: arCatalog.common.navigation.assistant,
    workspace: arCatalog.common.workspace,
  },
  en: {
    home: enCatalog.common.navigation.home,
    signIn: enCatalog.auth.signIn,
    register: enCatalog.auth.register,
    assistant: enCatalog.common.navigation.assistant,
    workspace: enCatalog.common.workspace,
  },
} as const;
