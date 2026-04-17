import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChatWidget } from '../context/ChatWidgetContext';
import ChatPanel from './chat/ChatPanel';

const ChatWidget = () => {
  const { user } = useAuth();
  const { open, setOpen, focusChatId, clearFocusChat } = useChatWidget();
  const [mountedPanel, setMountedPanel] = useState(false);

  useEffect(() => {
    if (open) setMountedPanel(true);
  }, [open]);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fab-3d fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-2 ring-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        aria-expanded={open}
        aria-label={open ? 'Close messages' : 'Open messages'}
      >
        {open ? (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>

      {mountedPanel && (
        <div
          className={`fixed bottom-24 right-5 z-[59] flex w-[min(100vw-2.5rem,22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl [transform-style:preserve-3d] transition duration-200 ease-out ${
            open
              ? 'pointer-events-auto translate-y-0 opacity-100 [transform:perspective(1200px)_rotateX(2deg)_translateY(0)]'
              : 'pointer-events-none translate-y-2 opacity-0'
          }`}
          style={{ maxHeight: 'min(85vh, 34rem)' }}
          aria-hidden={!open}
        >
          <ChatPanel
            variant="widget"
            focusChatId={focusChatId}
            onFocusConsumed={clearFocusChat}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
};

export default ChatWidget;
