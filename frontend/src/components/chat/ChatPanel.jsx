import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getSocket } from '../../utils/socket';
import AiAssistantPane from './AiAssistantPane';

const meId = (user) => String(user?.id || user?._id || '');

const tabBtn = (active) =>
  `flex-1 rounded-t-lg px-3 py-2 text-center text-xs font-semibold transition sm:text-sm ${
    active ? 'bg-[#003580] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
  }`;

const ChatPanel = ({ variant = 'page', focusChatId = null, onFocusConsumed, onClose }) => {
  const { user } = useAuth();
  const socket = useMemo(() => getSocket(), []);
  const { tv } = useLanguage();
  const [mode, setMode] = useState('ai');
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data } = await client.get('/chats');
        if (cancelled) return;
        setChats(data);
        if (!data?.length) {
          setActiveChat(null);
          return;
        }
        if (focusChatId) {
          const found = data.find((c) => String(c._id) === String(focusChatId));
          if (found) {
            setActiveChat(found);
            setMode('hosts');
            onFocusConsumed?.();
            return;
          }
        }
        setActiveChat((prev) => {
          if (prev && data.some((c) => String(c._id) === String(prev._id))) return prev;
          return data[0];
        });
      } catch (error) {
        if (!cancelled) {
          setChats([]);
          setActiveChat(null);
          toast.error(error.response?.data?.message || tv('Could not load chats', 'Không tải được đoạn chat'));
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [focusChatId, onFocusConsumed]);

  useEffect(() => {
    if (!activeChat) return;
    client
      .get(`/chats/${activeChat._id}/messages`)
      .then(({ data }) => setMessages(data))
      .catch((error) => {
        setMessages([]);
        toast.error(error.response?.data?.message || tv('Could not load messages', 'Không tải được tin nhắn'));
      });
    socket.emit('join:chat', activeChat._id);

    const onMessage = (msg) => {
      if (String(msg.chatId) === String(activeChat._id)) setMessages((prev) => [...prev, msg]);
    };
    socket.on('chat:message', onMessage);

    return () => {
      socket.emit('leave:chat', activeChat._id);
      socket.off('chat:message', onMessage);
    };
  }, [activeChat, socket]);

  const send = async (e) => {
    e.preventDefault();
    if (!activeChat || !message.trim()) return;
    try {
      await client.post('/chats/message', { chatId: activeChat._id, content: message });
      setMessage('');
    } catch (error) {
      toast.error(error.response?.data?.message || tv('Send failed', 'Gửi tin nhắn thất bại'));
    }
  };

  const peerLabel = (chat) => {
    const target = chat.participants?.find((p) => String(p._id) !== meId(user));
    return target?.name || tv('Conversation', 'Cuộc trò chuyện');
  };

  const messagesScrollClass =
    variant === 'widget'
      ? 'min-h-0 flex-1 space-y-2 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2'
      : 'mb-3 h-96 space-y-2 overflow-y-auto rounded border p-2';

  const composer = (
    <form onSubmit={send} className="flex gap-2">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={tv('Type message...', 'Nhập tin nhắn...')}
        className="flex-1 rounded border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
      />
      <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm text-white">
        {tv('Send', 'Gửi')}
      </button>
    </form>
  );

  const modeTabs = (
    <div className="mb-2 flex gap-1 rounded-t-lg bg-slate-100 p-1">
      <button type="button" className={tabBtn(mode === 'ai')} onClick={() => setMode('ai')}>
        {tv('AI assistant', 'Trợ lý AI')}
      </button>
      <button type="button" className={tabBtn(mode === 'hosts')} onClick={() => setMode('hosts')}>
        {tv('Hosts', 'Chủ nhà')}
      </button>
    </div>
  );

  if (variant === 'widget') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2">
          <span className="text-sm font-semibold text-slate-900">{tv('Messages', 'Tin nhắn')}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label={tv('Close chat', 'Đóng chat')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          {modeTabs}
          {mode === 'ai' ? (
            <AiAssistantPane variant="widget" />
          ) : (
            <>
              <label className="sr-only" htmlFor="chat-widget-thread">
                {tv('Conversation', 'Cuộc trò chuyện')}
              </label>
              <select
                id="chat-widget-thread"
                className="rounded border border-slate-300 bg-white p-2 text-sm text-slate-900"
                value={activeChat?._id || ''}
                onChange={(e) => {
                  const c = chats.find((ch) => String(ch._id) === e.target.value);
                  if (c) setActiveChat(c);
                }}
              >
                {chats.length === 0 ? <option value="">{tv('No conversations yet', 'Chưa có cuộc trò chuyện')}</option> : null}
                {chats.map((chat) => (
                  <option key={chat._id} value={chat._id}>
                    {peerLabel(chat)}
                  </option>
                ))}
              </select>
              {!activeChat ? (
                <p className="text-sm text-slate-700">{tv('Open a property and use "Chat with host" to start.', 'Mở một chỗ ở và bấm "Chat với chủ nhà" để bắt đầu.')}</p>
              ) : (
                <>
                  <div className={messagesScrollClass}>
                    {messages.map((m) => (
                      <div
                        key={m._id}
                        className={`max-w-[85%] rounded p-2 text-sm ${
                          String(m.senderId?._id) === meId(user)
                            ? 'ml-auto border border-emerald-200 bg-emerald-100'
                            : 'border border-slate-200 bg-white shadow-sm'
                        }`}
                      >
                        <p className="font-semibold text-xs text-slate-800">{m.senderId?.name}</p>
                        <p className="text-slate-900">{m.content}</p>
                      </div>
                    ))}
                  </div>
                  {composer}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <aside className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">{tv('Chats', 'Đoạn chat')}</h2>
        <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          <button type="button" className={tabBtn(mode === 'ai')} onClick={() => setMode('ai')}>
            AI
          </button>
          <button type="button" className={tabBtn(mode === 'hosts')} onClick={() => setMode('hosts')}>
            {tv('Hosts', 'Chủ nhà')}
          </button>
        </div>
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat._id}
              type="button"
              onClick={() => {
                setActiveChat(chat);
                setMode('hosts');
              }}
              className={`w-full rounded border p-2 text-left text-sm ${
                String(activeChat?._id) === String(chat._id) ? 'border-emerald-500 bg-emerald-50' : ''
              }`}
            >
              {peerLabel(chat)}
            </button>
          ))}
        </div>
      </aside>

      <section className="md:col-span-2 rounded border bg-white p-3">
        {mode === 'ai' ? (
          <AiAssistantPane variant="page" />
        ) : !activeChat ? (
          <p className="text-sm text-slate-500">{tv('No chat selected.', 'Chưa chọn cuộc trò chuyện nào.')}</p>
        ) : (
          <>
            <div className={messagesScrollClass}>
              {messages.map((m) => (
                <div
                  key={m._id}
                  className={`max-w-[75%] rounded p-2 text-sm ${
                    String(m.senderId?._id) === meId(user) ? 'ml-auto bg-emerald-100' : 'bg-slate-100'
                  }`}
                >
                  <p className="font-semibold">{m.senderId?.name}</p>
                  <p>{m.content}</p>
                </div>
              ))}
            </div>
            {composer}
          </>
        )}
      </section>
    </>
  );
};

export default ChatPanel;
