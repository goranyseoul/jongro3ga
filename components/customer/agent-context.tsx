"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DirectoryTopic } from "@/lib/ui-data/directory";

// One agent per page, shown in a floating window (components/customer/agent-dock.tsx). Any screen can
// hand it a sentence with `ask`; the dock picks the request up, opens, and answers in its own chat.

export type AgentRequest = { id: number; text: string; topic?: DirectoryTopic };

type AgentContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Sends a message to the agent as if the customer typed it, and opens the window. */
  ask: (text: string, topic?: DirectoryTopic) => void;
  /** The latest request the dock has not handled yet; the dock clears it once it is in the chat. */
  pending: AgentRequest | null;
  clearPending: (id: number) => void;
};

const AgentContext = createContext<AgentContextValue | null>(null);

const DISMISSED_KEY = "pibu.agent.dismissed";

export function AgentProvider({ children }: { children: ReactNode }) {
  // Open from the start on the first visit; a customer who closed it keeps it closed.
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<AgentRequest | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (!dismissed) setIsOpen(true);
  }, []);

  const remember = (dismissed: boolean) => {
    try {
      if (dismissed) window.sessionStorage.setItem(DISMISSED_KEY, "1");
      else window.sessionStorage.removeItem(DISMISSED_KEY);
    } catch {
      // storage blocked: the window simply opens again next time
    }
  };

  const open = useCallback(() => {
    remember(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    remember(true);
    setIsOpen(false);
  }, []);

  const ask = useCallback((text: string, topic?: DirectoryTopic) => {
    remember(false);
    setPending((prev) => ({ id: (prev?.id ?? 0) + 1, text, topic }));
    setIsOpen(true);
  }, []);

  const clearPending = useCallback((id: number) => {
    setPending((prev) => (prev?.id === id ? null : prev));
  }, []);

  const value = useMemo(
    () => ({ isOpen, open, close, ask, pending, clearPending }),
    [isOpen, open, close, ask, pending, clearPending],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentContextValue {
  const value = useContext(AgentContext);
  if (!value) throw new Error("useAgent must be used inside AgentProvider");
  return value;
}
