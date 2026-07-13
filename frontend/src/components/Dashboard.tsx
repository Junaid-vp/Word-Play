"use client";
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  MessageSquare, UserPlus, LogOut, Send, Mic, Square, 
  Play, UserCheck, Shield, ChevronLeft, Volume2, Check, CheckCheck, Trash2,
  Clock, Pause, RefreshCw
} from 'lucide-react';
import { encryptText, decryptText } from '@/lib/crypto';
import { API_URL, getAuthHeaders } from '@/lib/config';

interface Friend {
  id: string;
  privateAlias: string;
  name?: string | null;
}

interface PendingRequest {
  id: string;
  sender: Friend;
}

interface MessageReceipt {
  userId: string;
  status: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  encryptedContent: string;
  type: 'TEXT' | 'VOICE';
  createdAt: string;
  receipts: MessageReceipt[];
  voiceAttachment?: {
    storageKey: string;
    duration: number;
  };
}

interface Conversation {
  id: string;
  members: { userId: string; user: Friend }[];
  messages: Message[];
}

export default function Dashboard({ user, onLogout, onLock }: { user: { id: string; privateAlias: string; name?: string | null }; onLogout: () => void; onLock: () => void }) {
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  const [activeView, setActiveView] = useState<'sidebar' | 'chat'>('sidebar');
  
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReqs, setPendingReqs] = useState<PendingRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  
  const [inviteCode, setInviteCode] = useState('');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<{ [key: string]: string }>({});
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const shouldSendRef = useRef(false);
  
  // Socket.IO
  const socketRef = useRef<Socket | null>(null);
  
  // Presence and Typing
  const [onlineUsers, setOnlineUsers] = useState<{ [key: string]: boolean }>({});
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: boolean }>({});
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  // Audio Playback State
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

  // Pause audio when switching conversations
  useEffect(() => {
    if (activeAudio) {
      activeAudio.pause();
      setPlayingMessageId(null);
      setActiveAudio(null);
    }
  }, [selectedConv]);

  // Clean up active audio on unmount or target change
  useEffect(() => {
    return () => {
      if (activeAudio) activeAudio.pause();
    };
  }, [activeAudio]);
  
  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const partner = selectedConv ? getPartner(selectedConv) : null;
  const isPartnerOnline = partner ? !!onlineUsers[partner.id] : false;
  const isPartnerTyping = partner ? !!typingUsers[partner.id] : false;

  const selectedConvRef = useRef<Conversation | null>(null);
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  // Fetch initial data
  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
    fetchConversations();
    fetchInviteCode();

    // Setup Socket
    const socket = io(API_URL, {
      transports: ['websocket'],
      auth: {
        token: localStorage.getItem('chat_token')
      }
    });
    socketRef.current = socket;

    socket.emit('auth', { userId: user.id });

    socket.on('presence:update', (data: { userId: string; status: 'online' | 'offline' }) => {
      setOnlineUsers(prev => ({ ...prev, [data.userId]: data.status === 'online' }));
    });

    socket.on('typing:start', (data: { conversationId: string; userId: string }) => {
      if (selectedConvRef.current?.id === data.conversationId) {
        setTypingUsers(prev => ({ ...prev, [data.userId]: true }));
      }
    });

    socket.on('typing:stop', (data: { conversationId: string; userId: string }) => {
      if (selectedConvRef.current?.id === data.conversationId) {
        setTypingUsers(prev => ({ ...prev, [data.userId]: false }));
      }
    });

    socket.on('message:receipt', (data: { messageId: string; userId: string; status: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          const receipts = m.receipts || [];
          if (!receipts.some(r => r.userId === data.userId && r.status === data.status)) {
            return {
              ...m,
              receipts: [...receipts, { userId: data.userId, status: data.status }]
            };
          }
        }
        return m;
      }));
    });

    socket.on('message:new', async (msg: Message & { clientId?: string }) => {
      if (selectedConvRef.current && msg.conversationId === selectedConvRef.current.id) {
        if (msg.clientId && msg.senderId === user.id) {
          setMessages(prev => {
            const index = prev.findIndex(m => m.id === msg.clientId);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = msg;
              return updated;
            }
            return [msg, ...prev];
          });
          const decrypted = await decryptText(msg.encryptedContent, selectedConvRef.current.id);
          setDecryptedMessages(prev => {
            const next = { ...prev };
            delete next[msg.clientId!];
            next[msg.id] = decrypted;
            return next;
          });
        } else {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [msg, ...prev];
          });
          const decrypted = await decryptText(msg.encryptedContent, selectedConvRef.current.id);
          setDecryptedMessages(prev => ({ ...prev, [msg.id]: decrypted }));
        }
      }
      fetchConversations();
    });

    socket.on('conversation:deleted', (data: { conversationId: string }) => {
      if (selectedConvRef.current?.id === data.conversationId) {
        setSelectedConv(null);
        setActiveView('sidebar');
        alert('This secure channel has been permanently deleted by the partner.');
      }
      fetchConversations();
    });

    socket.on('friend:request', () => {
      fetchPendingRequests();
    });

    socket.on('friend:accepted', () => {
      fetchFriends();
      fetchPendingRequests();
      fetchConversations();
    });

    socket.on('friend:declined', () => {
      fetchPendingRequests();
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read receipts auto-trigger when new messages arrive
  useEffect(() => {
    if (selectedConv && messages.length > 0 && socketRef.current) {
      messages.forEach(m => {
        if (m.senderId !== user.id) {
          const isRead = m.receipts?.some(r => r.userId === user.id && r.status === 'READ');
          if (!isRead) {
            socketRef.current?.emit('message:read', { messageId: m.id });
          }
        }
      });
    }
  }, [messages, selectedConv, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchFriends() {
    const res = await fetch(`${API_URL}/api/friend/friends`, {
      headers: getAuthHeaders()
    });
    if (res.ok) setFriends(await res.json());
  }

  async function fetchPendingRequests() {
    const res = await fetch(`${API_URL}/api/friend/friends/requests/pending`, {
      headers: getAuthHeaders()
    });
    if (res.ok) setPendingReqs(await res.json());
  }

  async function fetchConversations() {
    const res = await fetch(`${API_URL}/api/conversation`, {
      headers: getAuthHeaders()
    });
    if (res.ok) setConversations(await res.json());
  }

  async function fetchInviteCode() {
    const res = await fetch(`${API_URL}/api/friend/invite`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      setInviteCode(data.code);
    }
  }

  const handleGenerateInvite = async () => {
    const res = await fetch(`${API_URL}/api/friend/invite`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      setInviteCode(data.code);
    }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCodeInput.trim()) return;

    const res = await fetch(`${API_URL}/api/friend/friends/request`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code: friendCodeInput })
    });

    if (res.ok) {
      alert('Request sent!');
      setFriendCodeInput('');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to send request');
    }
  };

  const handleRespondRequest = async (requestId: string, accept: boolean) => {
    const res = await fetch(`${API_URL}/api/friend/friends/respond`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ requestId, accept })
    });

    if (res.ok) {
      fetchPendingRequests();
      fetchFriends();
    }
  };

  const handleStartChat = async (friendId: string) => {
    const res = await fetch(`${API_URL}/api/conversation`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetUserId: friendId })
    });

    if (res.ok) {
      const conv = await res.json();
      setSelectedConv(conv);
      setActiveView('chat');
      loadMessages(conv.id);
    }
  };

  const loadMessages = async (convId: string) => {
    const res = await fetch(`${API_URL}/api/conversation/${convId}/messages`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const msgs: Message[] = await res.json();
      setMessages(msgs);
      const decMap: { [key: string]: string } = {};
      for (const m of msgs) {
        decMap[m.id] = await decryptText(m.encryptedContent, convId);
      }
      setDecryptedMessages(decMap);

      if (socketRef.current) {
        socketRef.current.emit('conversation:join', { conversationId: convId });
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConv) return;

    const rawText = messageInput;
    const tempId = `opt-${Date.now()}`;
    
    // Clear input and stop typing immediately for a snappy feel
    setMessageInput('');
    handleStopTyping();

    const encrypted = await encryptText(rawText, selectedConv.id);

    // Optimistically inject the message in the UI list
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: selectedConv.id,
      senderId: user.id,
      encryptedContent: encrypted,
      type: 'TEXT',
      createdAt: new Date().toISOString(),
      receipts: []
    };

    setMessages(prev => [optimisticMsg, ...prev]);
    setDecryptedMessages(prev => ({ ...prev, [tempId]: rawText }));

    if (socketRef.current) {
      socketRef.current.emit('message:send', {
        conversationId: selectedConv.id,
        encryptedContent: encrypted,
        type: 'TEXT',
        clientId: tempId
      });
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    if (!confirm('PERMANENT DELETION: Are you sure you want to permanently delete this secure communication channel? All messages and attachments will be destroyed for both participants.')) return;

    const res = await fetch(`${API_URL}/api/conversation/${selectedConv.id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.ok) {
      socketRef.current?.emit('conversation:delete', { 
        conversationId: selectedConv.id,
        memberIds: selectedConv.members.map(m => m.userId)
      });
      setSelectedConv(null);
      setActiveView('sidebar');
      fetchConversations();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete channel');
    }
  };

  // Typing Indicators
  const handleTyping = () => {
    if (!selectedConv || !socketRef.current) return;

    socketRef.current.emit('typing:start', { conversationId: selectedConv.id });

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(handleStopTyping, 2000);
  };

  const handleStopTyping = () => {
    if (!selectedConv || !socketRef.current) return;
    socketRef.current.emit('typing:stop', { conversationId: selectedConv.id });
  };

  // Audio Recording
  const startRecording = async () => {
    try {
      shouldSendRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          options = { mimeType: 'audio/ogg;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }
      
      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        // Release the microphone
        stream.getTracks().forEach(track => track.stop());

        if (shouldSendRef.current) {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          await uploadAudio(audioBlob);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    }
  };

  const cancelRecording = () => {
    shouldSendRef.current = false;
    stopRecording();
  };

  const confirmSendRecording = () => {
    shouldSendRef.current = true;
    stopRecording();
  };

  const uploadAudio = async (blob: Blob) => {
    if (!selectedConv) return;
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('voice', blob, `voice.${ext}`);
    formData.append('duration', recordingDuration.toString());

    await fetch(`${API_URL}/api/conversation/${selectedConv.id}/voice`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeaders(false)
    });
  };

  const handleToggleAudio = (messageId: string, storageKey: string) => {
    if (playingMessageId === messageId) {
      if (activeAudio) {
        activeAudio.pause();
      }
      setPlayingMessageId(null);
    } else {
      if (activeAudio) {
        activeAudio.pause();
      }
      const audio = new Audio(`${API_URL}/uploads/${storageKey}`);
      audio.crossOrigin = "anonymous";
      audio.onended = () => {
        setPlayingMessageId(null);
        setActiveAudio(null);
      };
      audio.play().catch(err => console.error("Audio playback failed", err));
      setActiveAudio(audio);
      setPlayingMessageId(messageId);
    }
  };

  function getPartner(conv: Conversation) {
    return conv.members.find(m => m.userId !== user.id)?.user;
  }

  return (
    <div className="w-full h-full bg-neutral-950 text-neutral-200 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`w-full md:w-80 border-r border-neutral-900 flex flex-col bg-neutral-950/80 backdrop-blur ${activeView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-neutral-900 flex justify-between items-center bg-neutral-950">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold tracking-tight uppercase text-sm text-neutral-100">{user.name || user.privateAlias}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button 
              onClick={onLock} 
              className="text-neutral-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-900"
              title="Panic button / Refresh decoy"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={onLogout} 
              className="text-neutral-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-neutral-900"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switching */}
        <div className="flex border-b border-neutral-900 bg-neutral-950/50">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex justify-center items-center gap-1.5 ${activeTab === 'chats' ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chats
          </button>
          <button 
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex justify-center items-center gap-1.5 ${activeTab === 'friends' ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Friends
          </button>
        </div>

        {/* Scrollable Side Area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' ? (
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-600">No active chats. Start one with a friend!</div>
              ) : (
                conversations.map(c => {
                  const partnerItem = getPartner(c);
                  const isSelected = selectedConv?.id === c.id;
                  const isOnline = partnerItem ? onlineUsers[partnerItem.id] : false;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedConv(c); setActiveView('chat'); loadMessages(c.id); }}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center space-x-3 ${isSelected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/50 text-neutral-400'}`}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-sm uppercase text-neutral-200">
                          {(partnerItem?.name || partnerItem?.privateAlias || '?')[0]}
                        </div>
                        {isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-950"></span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <span className="font-medium text-sm text-neutral-200 block truncate">{partnerItem?.name || partnerItem?.privateAlias}</span>
                        </div>
                        <p className="text-xs text-neutral-500 truncate mt-0.5">
                          {c.messages[0] ? (c.messages[0].type === 'VOICE' ? 'Voice message' : 'Secure message') : 'Start typing...'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {/* My Invite Code */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Your Invitation Code</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-neutral-900 px-3 py-2.5 rounded-lg border border-neutral-800 font-mono text-sm tracking-widest text-neutral-100 uppercase select-all">
                    {inviteCode || 'Loading...'}
                  </div>
                  <button onClick={handleGenerateInvite} className="px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 text-xs font-medium transition-colors">
                    Regen
                  </button>
                </div>
                <span className="text-[10px] text-neutral-600 block">Give this code to a trusted entity. Code expires in 7 days.</span>
              </div>

              {/* Add Friend */}
              <form onSubmit={handleSendFriendRequest} className="space-y-2">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Add Entity Code</label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    placeholder="ENTER INVITE CODE" 
                    value={friendCodeInput}
                    onChange={e => setFriendCodeInput(e.target.value)}
                    className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 font-mono tracking-widest"
                  />
                  <button type="submit" className="px-4 py-2 bg-white text-black hover:bg-neutral-200 rounded-lg text-sm font-semibold transition-colors">
                    Add
                  </button>
                </div>
              </form>

              {/* Pending Requests */}
              {pendingReqs.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Incoming Authorizations</label>
                  <div className="space-y-2">
                    {pendingReqs.map(r => (
                      <div key={r.id} className="flex justify-between items-center bg-neutral-900/50 border border-neutral-900 p-3 rounded-lg">
                        <span className="text-sm font-medium text-neutral-200">{r.sender.name || r.sender.privateAlias}</span>
                        <div className="flex space-x-1.5">
                          <button onClick={() => handleRespondRequest(r.id, true)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/20 transition-colors">
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRespondRequest(r.id, false)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 p-1.5 rounded-lg border border-rose-500/20 transition-colors">
                            <Volume2 className="w-3.5 h-3.5 rotate-45" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friend List */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Trusted Directory</label>
                {friends.length === 0 ? (
                  <div className="text-xs text-neutral-600">No entities connected.</div>
                ) : (
                  <div className="space-y-1">
                    {friends.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleStartChat(f.id)}
                        className="w-full text-left p-3 bg-neutral-900/20 hover:bg-neutral-900/40 border border-neutral-900 hover:border-neutral-800 rounded-xl flex justify-between items-center transition-all group"
                      >
                        <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">{f.name || f.privateAlias}</span>
                        <span className="text-[10px] bg-neutral-900 text-neutral-600 px-2 py-0.5 rounded border border-neutral-800 group-hover:border-neutral-700 transition-colors">SECURE CHAT</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex-1 flex flex-col bg-neutral-950 relative ${activeView === 'sidebar' ? 'hidden md:flex' : 'flex'}`}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <header className="p-4 border-b border-neutral-900 flex justify-between items-center bg-neutral-950">
              <div className="flex items-center space-x-3">
                <button onClick={() => setActiveView('sidebar')} className="md:hidden text-neutral-500 hover:text-white transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div>
                  <h3 className="font-semibold text-sm text-neutral-200 uppercase">{partner?.name || partner?.privateAlias}</h3>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isPartnerOnline ? 'bg-emerald-500' : 'bg-neutral-700'}`}></span>
                    <span className="text-[10px] text-neutral-500 uppercase">{isPartnerOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={onLock} 
                  className="text-neutral-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-neutral-900"
                  title="Panic button / Refresh decoy"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleDeleteConversation}
                  className="text-neutral-500 hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-neutral-900"
                  title="Delete secure channel"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="hidden sm:block text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/10 tracking-widest animate-pulse">
                  AES-GCM SECURE CHANNEL
                </div>
              </div>
            </header>

            {/* Messages Screen */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
              <div ref={messagesEndRef} />
              
              {/* Typing indicator */}
              {isPartnerTyping && (
                <div className="flex justify-start">
                  <div className="bg-neutral-900 px-4 py-2.5 rounded-2xl text-xs text-neutral-500 border border-neutral-800 flex items-center space-x-1.5">
                    <span>typing</span>
                    <span className="flex space-x-0.5">
                      <span className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </div>
                </div>
              )}

              {messages.map(m => {
                const isMe = m.senderId === user.id;
                const isRead = m.receipts?.some(r => r.userId !== user.id && r.status === 'READ');
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm border shadow-sm ${
                      isMe 
                        ? 'bg-white text-black border-neutral-100 rounded-br-none' 
                        : 'bg-neutral-900 text-neutral-200 border-neutral-800 rounded-bl-none'
                    }`}>
                      {m.type === 'VOICE' ? (
                        <div className="flex items-center space-x-3.5">
                          <button 
                            onClick={() => handleToggleAudio(m.id, m.voiceAttachment?.storageKey || '')}
                            className={`p-2 rounded-full flex items-center justify-center transition-colors ${
                              isMe ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-800 text-white hover:bg-neutral-700'
                            }`}
                          >
                            {playingMessageId === m.id ? (
                              <Pause className="w-3.5 h-3.5 fill-current animate-pulse" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                          </button>
                          
                          {/* Visual waveform mockup */}
                          <div className="flex space-x-0.5 items-end h-4 w-24">
                            <span className={`w-0.5 h-2 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                            <span className={`w-0.5 h-3 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                            <span className={`w-0.5 h-4 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                            <span className={`w-0.5 h-1 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                            <span className={`w-0.5 h-3 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                            <span className={`w-0.5 h-4 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                            <span className={`w-0.5 h-2 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                            <span className={`w-0.5 h-1 rounded ${isMe ? 'bg-black/50' : 'bg-neutral-500'}`} />
                          </div>
                          
                          <span className={`text-[10px] font-mono ${isMe ? 'text-black/60' : 'text-neutral-500'}`}>
                            {m.voiceAttachment?.duration}s
                          </span>
                        </div>
                      ) : (
                        <p className="break-words leading-relaxed select-text">{decryptedMessages[m.id] || m.encryptedContent}</p>
                      )}
                      
                      <div className="flex items-center justify-end space-x-1 mt-1.5">
                        <span className={`text-[9px] font-mono ${isMe ? 'text-black/40' : 'text-neutral-600'}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          m.id.startsWith('opt-') ? (
                            <Clock className="w-3 h-3 text-neutral-400 animate-pulse" />
                          ) : isRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-neutral-400" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-neutral-900 bg-neutral-950">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2 max-w-4xl mx-auto">
                {isRecording ? (
                  <div className="flex-1 bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 rounded-lg text-rose-400 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      <span>RECORDING SECURE AUDIO: {recordingDuration}s</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        type="button" 
                        onClick={cancelRecording} 
                        className="text-rose-400 hover:text-white transition-colors bg-rose-500/20 p-1.5 rounded-md hover:bg-rose-500/30"
                        title="Cancel Recording"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button" 
                        onClick={confirmSendRecording} 
                        className="text-emerald-400 hover:text-white transition-colors bg-emerald-500/20 p-1.5 rounded-md hover:bg-emerald-500/30"
                        title="Send Recording"
                      >
                        <Send className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button 
                      type="button" 
                      onClick={startRecording}
                      className="p-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-lg hover:border-neutral-700 text-neutral-400 hover:text-white transition-all flex items-center justify-center"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    
                    <input 
                      type="text" 
                      placeholder="ENTER SECURE MESSAGE"
                      value={messageInput}
                      onChange={e => { setMessageInput(e.target.value); handleTyping(); }}
                      className="flex-1 bg-neutral-900 border border-neutral-800 px-4 py-3 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
                    />
                    
                    <button 
                      type="submit"
                      className="p-3 bg-white hover:bg-neutral-200 text-black rounded-lg transition-all flex items-center justify-center disabled:opacity-50"
                      disabled={!messageInput.trim()}
                    >
                      <Send className="w-4 h-4 fill-current" />
                    </button>
                  </>
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
            <Shield className="w-12 h-12 text-neutral-800 mb-4" />
            <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">No Active Secure Channel</h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Select an entity from your directory or use an invitation code to authorize a new communications line.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
