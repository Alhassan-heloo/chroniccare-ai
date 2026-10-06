import type { User } from "./user";
export interface Patient extends User {
  role: "patient";
  conditions: string[];
}
