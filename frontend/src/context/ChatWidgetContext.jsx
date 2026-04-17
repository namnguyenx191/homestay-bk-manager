import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ChatWidgetContext = createContext(null);

export function ChatWidgetProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [focusChatId, setFocusChatId] = useState(null);

  const openWidget = useCallback((chatId) => {
    if (chatId) setFocusChatId(String(chatId));
    setOpen(true);
  }, []);

  const closeWidget = useCallback(() => setOpen(false), []);

  const clearFocusChat = useCallback(() => setFocusChatId(null), []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openWidget,
      closeWidget,
      focusChatId,
      clearFocusChat,
    }),
    [open, focusChatId, openWidget, closeWidget, clearFocusChat]
  );

  return <ChatWidgetContext.Provider value={value}>{children}</ChatWidgetContext.Provider>;
}

export function useChatWidget() {
  const ctx = useContext(ChatWidgetContext);
  if (!ctx) throw new Error('useChatWidget must be used within ChatWidgetProvider');
  return ctx;
}
