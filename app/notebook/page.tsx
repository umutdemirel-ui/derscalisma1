"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

interface Notebook {
  id: string;
  title: string;
  achievement_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Achievement {
  id: string;
  kazanim_kodu: string;
  ders_adi: string;
  sinif_seviyesi: string;
  aciklama: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function NotebookPage() {
  return (
    <ProtectedRoute>
      <NotebookContent />
    </ProtectedRoute>
  );
}

function NotebookContent() {
  const router = useRouter();
  const { logout } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [newNotebookAchievement, setNewNotebookAchievement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotebooks();
    loadAchievements();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadNotebooks() {
    try {
      const res = await fetch("/api/notebooks", { credentials: "include" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.notebooks) setNotebooks(data.notebooks);
    } catch {
      setError("Not defterleri yüklenemedi");
    }
  }

  async function loadAchievements() {
    try {
      const res = await fetch("/api/achievements", { credentials: "include" });
      const data = await res.json();
      if (data.achievements) setAchievements(data.achievements);
    } catch {
      // ignore
    }
  }

  async function createNotebook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newNotebookTitle || "Adsız defter",
          achievement_id: newNotebookAchievement || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Not defteri oluşturulamadı");
      }

      setNotebooks([data.notebook, ...notebooks]);
      setSelectedNotebook(data.notebook);
      setShowNewNotebook(false);
      setNewNotebookTitle("");
      setNewNotebookAchievement("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oluşturma başarısız");
    }
  }

  async function selectNotebook(nb: Notebook) {
    setSelectedNotebook(nb);
    setMessages([]);
  }

  async function deleteNotebook(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Bu not defterini silmek istediğinizden emin misiniz?")) return;

    try {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Silme başarısız");

      setNotebooks(notebooks.filter(n => n.id !== id));
      if (selectedNotebook?.id === id) setSelectedNotebook(null);
    } catch {
      setError("Silme sırasında hata oluştu");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedNotebook) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("notebookId", selectedNotebook.id);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Yükleme başarısız");
      }

      alert(`Dosya yüklendi! ${data.chunksCreated} parça oluşturuldu. Embedding'ler arka planda işlenecek.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme başarısız");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedNotebook || loading) return;

    const userMessage = input;
    setMessages([...messages, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notebookId: selectedNotebook.id, question: userMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Sohbet hatası");
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setMessages(prev => [...prev, { role: "assistant", content: "Üzgünüm, bir hata oluştu: " + String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Ders Çalışma</h1>
          <button
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={() => setShowNewNotebook(true)}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors mb-4"
          >
            + Yeni Not Defteri
          </button>

          <nav>
            <ul className="space-y-1">
              {notebooks.map(nb => (
                <li key={nb.id}>
                  <button
                    onClick={() => selectNotebook(nb)}
                    onContextMenu={(e) => { e.preventDefault(); deleteNotebook(nb.id, e as any); }}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedNotebook?.id === nb.id
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <p className="font-medium truncate">{nb.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(nb.updated_at)}</p>
                  </button>
                </li>
              ))}
              {notebooks.length === 0 && (
                <li className="text-center text-gray-500 py-8 text-sm">
                  Henüz not defteri yok
                </li>
              )}
            </ul>
          </nav>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full py-2 px-4 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <button
              className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1 lg:flex-none">
              {selectedNotebook ? (
                <h2 className="text-lg font-semibold text-gray-900 truncate">{selectedNotebook.title}</h2>
              ) : (
                <h2 className="text-lg font-semibold text-gray-900">Not defteri seçin veya oluşturun</h2>
              )}
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 lg:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between" role="alert">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-600 hover:underline text-sm">Kapat</button>
            </div>
          )}

          {!selectedNotebook ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 110 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 11-4 0v-1a1 1 0 00-1-1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 110-4H7a1 1 0 00-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Henüz bir not defteri seçilmedi</h3>
                <p className="mt-2 text-gray-500">Sol taraftan bir not defteri seçin veya "Yeni Not Defteri" butonuyla bir tane oluşturun.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
              {/* Upload area */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">Materyal Yükle</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.jpg,.jpeg,.png"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-gray-600">PDF, metin veya görsel dosyası sürükleyip bırakın veya tıklayın</p>
                    <p className="text-sm text-gray-400 mt-1">Maksimum 10MB</p>
                  </label>
                  {uploading && <p className="mt-2 text-blue-600">Yükleniyor...</p>}
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 whitespace-pre-wrap">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="mt-4">Yüklenen materyaller hakkında soru sorun</p>
                      <p className="text-sm mt-1">Örn: "Bu konunun özeti nedir?", "Önemli formüller nelerdir?"</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md whitespace-pre-wrap"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-gray-200 p-4">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Sorunuzu yazın..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      disabled={loading}
                      maxLength={2000}
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? "Düşünüyor..." : "Gönder"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Notebook Modal */}
      {showNewNotebook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewNotebook(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Yeni Not Defteri</h3>
            <form onSubmit={createNotebook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
                <input
                  type="text"
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  placeholder="Örn: 9. Sınıf Matematik - Fonksiyonlar"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kazanıma Bağla (İsteğe Bağlı)</label>
                <select
                  value={newNotebookAchievement}
                  onChange={(e) => setNewNotebookAchievement(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Seçilmedi</option>
                  {achievements.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.kazanim_kodu} - {a.ders_adi} {a.sinif_seviyesi}. Sınıf
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowNewNotebook(false)} className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">Oluştur</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}