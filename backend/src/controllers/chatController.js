const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { emitToChat } = require('../utils/socket');

const getMyChats = async (req, res) => {
  const chats = await Chat.find({ participants: req.user._id })
    .populate('participants', 'name email role')
    .populate('homestayId', 'title location')
    .sort({ lastMessageAt: -1 });

  res.json(chats);
};

const getChatMessages = async (req, res) => {
  const chat = await Chat.findById(req.params.chatId);
  if (!chat) return res.status(404).json({ message: 'Chat not found' });

  const isMember = chat.participants.some((id) => String(id) === String(req.user._id));
  if (!isMember) return res.status(403).json({ message: 'Forbidden' });

  const messages = await Message.find({ chatId: req.params.chatId })
    .populate('senderId', 'name role')
    .sort({ createdAt: 1 });

  res.json(messages);
};

const startOrGetChat = async (req, res) => {
  const { participantId, homestayId } = req.body;
  const ids = [String(req.user._id), String(participantId)].sort();

  let chat = await Chat.findOne({ participants: { $all: ids, $size: 2 }, homestayId: homestayId || null });
  if (!chat) {
    chat = await Chat.create({ participants: ids, homestayId: homestayId || null });
  }

  await chat.populate('participants', 'name email role');
  await chat.populate('homestayId', 'title location');

  res.status(201).json(chat);
};

const sendMessage = async (req, res) => {
  const { chatId, content } = req.body;
  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ message: 'Chat not found' });

  const isMember = chat.participants.some((id) => String(id) === String(req.user._id));
  if (!isMember) return res.status(403).json({ message: 'Forbidden' });

  const message = await Message.create({ chatId, senderId: req.user._id, content });
  chat.lastMessageAt = new Date();
  await chat.save();

  await message.populate('senderId', 'name role');
  emitToChat(String(chatId), 'chat:message', message);

  res.status(201).json(message);
};

module.exports = { getMyChats, getChatMessages, startOrGetChat, sendMessage };
