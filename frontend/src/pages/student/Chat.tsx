import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api";
import ArcLoader from "../../components/ArcLoader";

interface Conversation {
  facultyId: string; facultyName: string; facultyEmail: string;
  lastMessage: string | null; lastMessageAt: string | null;
}

interface ChatMsg {
  id: string; sentByStudent: boolean; message: string;
  attachmentUrl?: string | null; attachmentType?: string | null; createdAt: string;
}

export default function StudentChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [active, setActive] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    setLoadingConvos(true);
    api.get<Conversation[]>("/api/v1/chat/my-conversations").then((r) => setConversations(r.data)).finally(() => setLoadingConvos(false));
  };

  useEffect(() => { loadConversations(); }, []);

  const openConversation = async (c: Conversation) => {
    setActive(c);
    setThread([]);
    const r = await api.get<ChatMsg[]>(`/api/v1/chat/faculty/${c.facultyId}/messages`);
    setThread(r.data);
  };

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const sendMessage = async (attachmentUrl?: string, attachmentType?: string) => {
    if (!active || (!message.trim() && !attachmentUrl)) return;
    const text = message;
    setMessage("");
    await api.post(`/api/v1/chat/faculty/${active.facultyId}/messages`, {
      facultyId: active.facultyId, message: text, attachmentUrl, attachmentType,
    });
    const r = await api.get<ChatMsg[]>(`/api/v1/chat/faculty/${active.facultyId}/messages`);
    setThread(r.data);
    loadConversations();
  };

  const uploadAndSend = async (file: File, type: string) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await api.post("/api/v1/uploads/file", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await sendMessage(up.data.url, type);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAndSend(file, file.type.startsWith("image/") ? "image" : "file");
    e.target.value = "";
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        uploadAndSend(new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }), "voice");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      alert("Couldn't access microphone. Check browser permissions.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Chat with Faculty</h1>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex" style={{ height: "70vh" }}>
        {/* Conversation list */}
        <div className="w-64 border-r border-gray-100 overflow-y-auto shrink-0">
          {loadingConvos ? (
            <ArcLoader label="Loading conversations" />
          ) : conversations.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No faculty assigned yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.facultyId}
                onClick={() => openConversation(c)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${active?.facultyId === c.facultyId ? "bg-primary/5" : ""}`}
              >
                <p className="text-sm font-medium text-gray-800 truncate">{c.facultyName}</p>
                <p className="text-xs text-gray-400 truncate">{c.lastMessage || "No messages yet"}</p>
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select your faculty to start chatting
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-medium text-gray-800">{active.facultyName}</p>
                <p className="text-xs text-gray-400">{active.facultyEmail}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {thread.map((m) => (
                  <div key={m.id} className={`text-sm rounded-lg px-3 py-2 max-w-[70%] ${!m.sentByStudent ? "bg-gray-100 mr-auto" : "bg-primary/10 ml-auto"}`}>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">{m.sentByStudent ? "You" : active.facultyName}</p>
                    {m.attachmentType === "image" && m.attachmentUrl && (
                      <img src={m.attachmentUrl} alt="attachment" className="rounded-md max-w-full mb-1" />
                    )}
                    {m.attachmentType === "voice" && m.attachmentUrl && (
                      <audio controls src={m.attachmentUrl} className="mb-1 max-w-full" />
                    )}
                    {m.attachmentType === "file" && m.attachmentUrl && (
                      <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary underline block mb-1">📎 Attached file</a>
                    )}
                    {m.message && <p className="text-gray-800">{m.message}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                <div ref={threadEndRef} />
              </div>
              <div className="flex gap-2 p-3 border-t border-gray-100 items-center">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file/image" className="text-gray-400 hover:text-gray-600 text-lg px-1">📎</button>
                <button onClick={toggleRecording} title={recording ? "Stop recording" : "Record voice message"} className={`text-lg px-1 ${recording ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-gray-600"}`}>🎤</button>
                <input
                  className="input flex-1"
                  placeholder={uploading ? "Uploading…" : "Type a message…"}
                  value={message}
                  disabled={uploading}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button onClick={() => sendMessage()} disabled={uploading} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
