import type { User } from "./user";
export interface Doctor extends User {
  role: "doctor";
  specialty: string;
}
