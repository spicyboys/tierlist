"use client";

import { createContext, useContext } from "react";

export interface User {
  id: string;
  username: string;
}

const UserContext = createContext<User | null>(null);

export const useUser = () => {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return user;
};

export default function UserProvider({ user, children }: { user: User, children: React.ReactNode }) {
  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
}