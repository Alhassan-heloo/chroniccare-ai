export const endpoints = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    session: "/auth/me",
  },
  measurements: "/measurements",
  medications: "/medications",
  habits: "/habits",
  notifications: "/notifications",
  ai: { chat: "/ai/chat" },
} as const;
