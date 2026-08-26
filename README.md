# Ders Çalışma Uygulaması

Maarif Modeli uyumlu, NotebookLM/Astra AI tarzı yapay zeka destekli ders çalışma platformu.

## Özellikler

- **Kimlik Doğrulama**: E-posta/şifre ile kayıt ve giriş, JWT tabanlı session yönetimi, HttpOnly cookie
- **Not Defterleri**: NotebookLM tarzı çalışma alanları, dosya yükleme, AI sohbet
- **RAG Mimarisi**: PDF/metin yükler → parçalanır → embedding oluşturulur → soru sorulduğunda en alakalı parçalar bulunur → OpenAI gpt-4o-mini cevaplar
- **Maarif Modeli Uyumu**: MEB kazanım kodları (`9.1.2.3` gibi), notebook'lar kazanıma bağlanabilir, ilerleme takibi
- **Quiz Üretimi**: Yüklenen materyallerden otomatik çoktan seçmeli quiz oluşturma
- **Güvenlik**: bcrypt şifre hashleme, rate limiting, input validation, SQL injection koruması

## Teknoloji

- **Frontend**: Next.js 14 (App Router), React 18
- **Backend**: Next.js API Routes
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT + HttpOnly Cookie (bcrypt password hashing)
- **AI**: OpenAI gpt-4o-mini (chat), text-embedding-3-large (embeddings)
- **Embedding Provider**: Voyage AI veya OpenAI (configurable)

## Kurulum

1. **Repository'yi klonlayın**
2. **Bağımlılıkları yükleyin**:
   ```bash
   npm install
   ```
3. **Environment variables**:
   ```bash
   cp .env.local.example .env.local
   # .env.local dosyasını düzenleyin:
   # SESSION_SECRET: openssl rand -base64 32 ile oluşturun
   # OPENAI_API_KEY: https://platform.openai.com/api-keys
   # EMBEDDING_PROVIDER=openai (veya voyage)
   # VOYAGE_API_KEY: voyage kullanıyorsanız
   ```
4. **Veritabanını başlatın**:
   ```bash
   npm run db:init
   ```
5. **Geliştirme sunucusunu başlatın**:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Açıklama | Zorunlu |
|----------|----------|---------|
| `SESSION_SECRET` | JWT imzalama anahtarı (min 32 karakter) | Evet |
| `OPENAI_API_KEY` | OpenAI API key | Evet |
| `EMBEDDING_PROVIDER` | `openai` veya `voyage` | Evet |
| `VOYAGE_API_KEY` | Voyage AI key (provider=voyage ise) | Hayır |
| `ANTHROPIC_API_KEY` | Anthropic key (Claude kullanacaksanız) | Hayır |

## Proje Yapısı

```
app/
├── api/
│   ├── auth/
│   │   ├── register/     # Kayıt endpoint'i
│   │   ├── login/        # Giriş endpoint'i
│   │   ├── logout/       # Çıkış endpoint'i
│   │   └── me/           # Mevcut kullanıcı bilgisi
│   ├── chat/             # RAG sohbet endpoint'i
│   ├── embeddings/       # Embedding oluşturma
│   ├── notebooks/        # Notebook CRUD
│   ├── quiz/             # Quiz üretimi ve cevaplama
│   └── upload/           # Dosya yükleme + chunking
├── login/                # Giriş sayfası
├── register/             # Kayıt sayfası
├── notebook/             # Ana çalışma arayüzü
├── layout.tsx
├── page.tsx              # /login'e yönlendirir
└── globals.css
lib/
├── auth/
│   ├── auth.ts           # Auth servisi (register, login, logout, session)
│   ├── client.ts         # Frontend auth client
│   ├── AuthProvider.tsx  # React context provider
│   └── ProtectedRoute.tsx # Protected route wrapper
├── api/
│   └── middleware.ts     # Auth middleware (requireAuth, rateLimit)
├── db/
│   └── database.ts       # SQLite veritabanı + şema
└── embeddings.ts         # Embedding utility
scripts/
└── init-db.ts            # Veritabanı başlatma scripti
```

## Kullanım Akışı

1. **Giriş**: `/login` → e-posta/şifre gir → `/notebook`
2. **Not Defteri Oluştur**: Sol sidebar'dan "Yeni Not Defteri" → başlık + kazanıma bağla (opsiyonel)
3. **Materyal Yükle**: PDF/metin/görsel sürükle-bırak → otomatik chunking → arka planda embedding
4. **Soru Sor**: Sağ panelden materyal hakkında soru sor → RAG + OpenAI cevaplar
5. **Quiz Çöz**: API `/api/quiz` POST → notebookId ver → quiz oluştur → cevapla → puan al

## Embedding İşleme

Dosya yüklendikten sonra chunk'lar `embedding=NULL` ile kaydedilir. Embedding'leri oluşturmak için:

```bash
# Manuel tetikleme
curl -X POST http://localhost:3000/api/embeddings \
  -H "Content-Type: application/json" \
  -b "session=..." \
  -d '{}'
```

## Veritabanı Şeması

- **users**: id, username, email, password_hash, display_name, avatar, email_verified, role, is_active, created_at, last_login_at
- **sessions**: id, user_id, expires_at, created_at, user_agent, ip
- **achievements**: MEB kazanım kodları (seed data ile gelir)
- **notebooks**: Kullanıcı not defterleri
- **documents**: Yüklenen dosyalar
- **chunks**: RAG için parçalanmış içerik + embedding
- **quizzes/questions/answers**: Quiz sistemi
- **progress**: Kazanım bazlı ilerleme takibi

## Güvenlik

- Şifreler **bcrypt (cost: 12)** ile hashlenir
- JWT token **HttpOnly, Secure, SameSite=Lax** cookie'de saklanır
- Rate limiting: register (5/dk), login (10/dk) per IP
- Input validation: Zod + manuel kontrol
- SQL injection koruması: Parameterized queries (better-sqlite3)
- CORS: Sadece same-origin

## Lisans

MIT

## Otomatik Misafir Girişi

Bu sürümde kullanıcı girişi/kayıt ekranı kaldırılmıştır. Ana sayfaya gelen ziyaretçi otomatik olarak bir misafir hesabı ve oturumla uygulamaya alınır.
