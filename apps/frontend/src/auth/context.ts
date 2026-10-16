import { createContext, useContext } from "react";
import type { User } from "@/lib/types/user";
export interface AuthValue {
  user: User | null;
  demo: boolean;
  expired: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enterDemo: () => Promise<void>;
}
export const AuthContext = createContext<AuthValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
