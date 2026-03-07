import { createContext, useContext, useState, ReactNode } from "react";

export interface User {
  name: string;
  email: string;
  studio: string;
  location: string;
  avatar: string;
  plan: "free" | "premium";
}

const DEMO_USER: User = {
  name: "Phyllis R.",
  email: "demo@artswrk.com",
  studio: "FieldCrest School of Performing Arts",
  location: "Bayside, NY",
  avatar: "PR",
  plan: "premium",
};

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  function login(email: string, password: string): boolean {
    const validEmail = email.toLowerCase().trim() === "demo@artswrk.com";
    const validPassword = password === "ArtswrkDemo2024";
    if (validEmail && validPassword) {
      setUser(DEMO_USER);
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
