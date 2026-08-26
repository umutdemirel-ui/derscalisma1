export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  email_verified: number;
  role: string;
  created_at: string;
  last_login_at: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

type AuthListener = (state: AuthState) => void;

async function readApiResponse(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  if (!contentType.includes("application/json")) {
    console.error("API JSON yerine yanıt döndürdü:", {
      status: res.status,
      contentType,
      url: res.url,
      body: raw.slice(0, 500),
    });
    throw new Error(
      res.status === 404
        ? "API endpoint bulunamadı. Netlify deploy ayarlarını kontrol edin."
        : "Sunucu JSON yerine HTML/başka bir yanıt döndürdü. Netlify Functions loglarını kontrol edin."
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Sunucudan geçersiz JSON yanıtı geldi.");
  }
}

class AuthClient {
  private state: AuthState = {
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  };
  private listeners: Set<AuthListener> = new Set();
  private initialized = false;

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.state));
  }

  private setState(partial: Partial<AuthState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await readApiResponse(res);

      if (data.authenticated && data.user) {
        this.setState({
          user: data.user,
          isAuthenticated: true,
          loading: false,
        });
      } else {
        this.setState({
          user: null,
          isAuthenticated: false,
          loading: false,
        });
      }
    } catch {
      this.setState({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  }

  async login(email: string, password: string): Promise<User> {
    this.setState({ loading: true, error: null });

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await readApiResponse(res);

    if (!res.ok || !data.success) {
      const message = data.error?.message || "Giriş başarısız";
      this.setState({ loading: false, error: message });
      throw new Error(message);
    }

    this.setState({
      user: data.user,
      isAuthenticated: true,
      loading: false,
      error: null,
    });

    return data.user;
  }

  async register(username: string, email: string, password: string): Promise<User> {
    this.setState({ loading: true, error: null });

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, email, password }),
    });

    const data = await readApiResponse(res);

    if (!res.ok || !data.success) {
      const message = data.error?.message || "Kayıt başarısız";
      this.setState({ loading: false, error: message });
      throw new Error(message);
    }

    this.setState({
      user: data.user,
      isAuthenticated: true,
      loading: false,
      error: null,
    });

    return data.user;
  }

  async logout(): Promise<void> {
    this.setState({ loading: true });

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }

    this.setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await readApiResponse(res);

      if (data.authenticated && data.user) {
        this.setState({
          user: data.user,
          isAuthenticated: true,
        });
      } else {
        this.setState({
          user: null,
          isAuthenticated: false,
        });
      }
    } catch {
      this.setState({
        user: null,
        isAuthenticated: false,
      });
    }
  }

  getState(): AuthState {
    return this.state;
  }
}

export const authClient = new AuthClient();

export function useAuth(): AuthState {
  if (typeof window === "undefined") {
    return { user: null, isAuthenticated: false, loading: true, error: null };
  }
  return authClient.getState();
}

export function useAuthSubscribe(listener: (state: AuthState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  return authClient.subscribe(listener);
}