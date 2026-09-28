import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { auth } from "./supabase";
import { useCacheOwner } from "./query";

type SessionValue =
  | { status: "loading"; session: null; userId: null }
  | { status: "signedOut"; session: null; userId: null }
  | { status: "signedIn"; session: Session; userId: string };

const Ctx = createContext<SessionValue | null>(null);

/**
 * Who is signed in on this device. Read from the keychain on launch, then kept
 * current by Supabase Auth (sign-in, token refresh, sign-out). The saved screen
 * cache follows it, so signing out removes the last person's figures.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data } = auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  useCacheOwner(session === undefined ? null : userId);

  const value = useMemo<SessionValue>(() => {
    if (session === undefined) return { status: "loading", session: null, userId: null };
    if (!session) return { status: "signedOut", session: null, userId: null };
    return { status: "signedIn", session, userId: session.user.id };
  }, [session]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
