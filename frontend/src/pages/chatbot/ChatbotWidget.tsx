import { useState } from "react";
import { aiAssistantApi } from "../../api/aiAssistantApi";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatbotWidget() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your 24/7 assistant. Ask me about courses, assessments, or your career prep." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await aiAssistantApi.chat(userMsg.content, nextMessages.slice(-6));
      setMessages((m) => [...m, { role: "assistant", content: res.response }]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[480px] bg-white rounded-xl shadow border">
      <div className="p-3 border-b font-semibold text-slate-700">AI Assistant</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-slate-800 text-white" : "bg-slate-100 text-slate-800"}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-slate-400 text-sm">Thinking...</div>}
      </div>
      {error && <div className="px-4 py-2 text-red-600 text-xs">{error}</div>}
      <div className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border rounded-md px-3 py-2 text-sm"
          placeholder="Ask something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Send</button>
      </div>
    </div>
  );
}
