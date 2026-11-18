export interface User {
  mustChangePassword?: boolean;
  id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "admin";
}
