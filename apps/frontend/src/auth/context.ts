import { createContext, useContext } from "react";
import type { User } from "@/lib/types/user";
import type { AuthorizedRequest } from "./api";
export interface AuthValue {
  user: User | null;
  expired: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  request: AuthorizedRequest;
}
export const AuthContext = createContext<AuthValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
