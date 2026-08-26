import initSqlJs from "sql.js";
import { join } from "path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";

type Database = any;
type Statement = any;

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, "app.db");
const SQL_WASM_PATH = join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");

let db: Database | null = null;
let isInitialized = false;

export async function getDb(): Promise<Database> {
  if (db && isInitialized) return db;

  const SQL = await initSqlJs({
    locateFile: () => SQL_WASM_PATH,
  });

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL.Database();
  }

  initDatabase(db);
  isInitialized = true;

  // Persist changes periodically
  setInterval(saveDb, 5000);

  return db;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
  } catch (error) {
    console.error("Failed to save database:", error);
  }
}

// Ensure data is saved on process exit
process.on("exit", saveDb);
process.on("SIGINT", () => {
  saveDb();
  process.exit(0);
});
process.on("SIGTERM", () => {
  saveDb();
  process.exit(0);
});

function initDatabase(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar TEXT,
      email_verified INTEGER DEFAULT 0,
      role TEXT DEFAULT 'user',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_agent TEXT,
      ip TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      kazanim_kodu TEXT NOT NULL UNIQUE,
      ders_adi TEXT NOT NULL,
      sinif_seviyesi TEXT NOT NULL,
      aciklama TEXT
    );

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Adsız defter',
      achievement_id TEXT REFERENCES achievements(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON notebooks(user_id);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      file_type TEXT NOT NULL,
      file_name TEXT,
      raw_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding BLOB,
      chunk_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'ready',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      given_answer TEXT,
      is_correct INTEGER,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL REFERENCES achievements(id),
      completion_rate REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, achievement_id)
    );
  `);

  seedAchievements(db);
}

function seedAchievements(db: Database) {
  const count = db.exec("SELECT COUNT(*) as c FROM achievements");
  if (count[0]?.values[0]?.[0] > 0) return;

  const achievements = [
    ['9.1.1.1', 'Matematik', '9', 'Sayı kümelerini tanır ve bu kümeler arasındaki ilişkileri açıklar'],
    ['9.1.1.2', 'Matematik', '9', 'Reel sayılarda işlem yapar ve özelliklerini kullanır'],
    ['9.1.1.3', 'Matematik', '9', 'Mutlak değer kavramını açıklar ve mutlak değeri verilen denklemleri çözer'],
    ['9.1.2.1', 'Matematik', '9', 'Fonksiyon kavramını tanımlar ve fonksiyon türlerini sınıflandırır'],
    ['9.1.2.2', 'Matematik', '9', 'Fonksiyonların grafiklerini çizer ve özelliklerini yorumlar'],
    ['9.1.2.3', 'Matematik', '9', 'Birinci dereceden fonksiyonları inceler ve grafiklerini çizer'],
    ['9.1.2.4', 'Matematik', '9', 'İkinci dereceden fonksiyonları inceler ve grafiklerini çizer'],
    ['9.2.1.1', 'Matematik', '9', 'Polinomları tanır ve polinomlarda işlem yapar'],
    ['9.2.1.2', 'Matematik', '9', 'Polinomları çarpanlarına ayırır'],
    ['9.2.2.1', 'Matematik', '9', 'Parçalı (rasyonel) ifadeleri sadeleştirir ve işlem yapar'],
    ['9.3.1.1', 'Matematik', '9', 'Denklem ve eşitsizlik sistemlerini çözer ve yorumlar'],
    ['9.3.1.2', 'Matematik', '9', 'İkinci dereceden denklemleri çözer ve köklerini yorumlar'],
    ['9.3.2.1', 'Matematik', '9', 'Eşitsizlikleri çözer ve çözüm kümelerini sayı doğrusunda gösterir'],
    ['10.1.1.1', 'Matematik', '10', 'Kümeler arası ilişkileri ve fonksiyon kavramını genelleştirir'],
    ['10.1.1.2', 'Matematik', '10', 'Ters fonksiyon kavramını açıklar ve ters fonksiyonu bulur'],
    ['10.1.2.1', 'Matematik', '10', 'Üstel ve logaritmik fonksiyonları tanımlar ve özelliklerini inceler'],
    ['10.1.2.2', 'Matematik', '10', 'Üstel ve logaritmik denklemleri çözer'],
    ['10.2.1.1', 'Matematik', '10', 'Trigonometrik fonksiyonları birim çember üzerinde tanımlar'],
    ['10.2.1.2', 'Matematik', '10', 'Trigonometrik fonksiyonların grafiklerini çizer ve özelliklerini inceler'],
    ['10.2.2.1', 'Matematik', '10', 'Trigonometrik denklemleri çözer'],
    ['10.3.1.1', 'Matematik', '10', 'Diziler ve seriler kavramını açıklar'],
    ['10.3.1.2', 'Matematik', '10', 'Aritmetik ve geometrik dizileri inceler'],
    ['10.3.2.1', 'Matematik', '10', 'Sınır kavramını ve limitleri inceler'],
    ['9.1.1.1', 'Fizik', '9', 'Fizik biliminin tanımını, yöntemini ve bilimsel yöntemini açıklar'],
    ['9.1.1.2', 'Fizik', '9', 'Fizik niceliklerini, birim sistemlerini ve ölçmeyi açıklar'],
    ['9.1.2.1', 'Fizik', '9', 'Hareketi, referans sistemini ve vektörleri açıklar'],
    ['9.1.2.2', 'Fizik', '9', 'Düzgün doğrusal hareketi ve hız-konum grafiklerini inceler'],
    ['9.1.2.3', 'Fizik', '9', 'Düzgün değişen doğrusal hareketi ve ivme kavramını inceler'],
    ['9.2.1.1', 'Fizik', '9', 'Kuvvet kavramını ve Newton hareket yasalarını açıklar'],
    ['9.2.1.2', 'Fizik', '9', 'Kütle, ağırlık ve yerçekimi ivmesini ayırt eder'],
    ['9.2.2.1', 'Fizik', '9', 'Sürtünme kuvvetini, yönünü ve etkilerini açıklar'],
    ['9.3.1.1', 'Fizik', '9', 'İş, enerji ve güç kavramlarını tanımlar'],
    ['9.3.1.2', 'Fizik', '9', 'Kinetik ve potansiyel enerjiyi, enerji korunumu yasasını açıklar'],
    ['9.1.1.1', 'Kimya', '9', 'Maddenin yapısını ve özelliklerini inceler'],
    ['9.1.1.2', 'Kimya', '9', 'Atom modellerinin tarihsel gelişimini açıklar'],
    ['9.1.2.1', 'Kimya', '9', 'Periyodik tabloyu, periyodik özellikleri inceler'],
    ['9.1.2.2', 'Kimya', '9', 'Elementlerin periyodik değişimini açıklar'],
    ['9.2.1.1', 'Kimya', '9', 'Kimyasal bağları (iyonik, kovalent, metalik) açıklar'],
    ['9.2.1.2', 'Kimya', '9', 'Molekül geometrisini VSEPR teorisiyle tahmin eder'],
    ['9.3.1.1', 'Kimya', '9', 'Gaz yasalarını ve gazların davranışını açıklar'],
    ['9.3.1.2', 'Kimya', '9', 'İdeal gaz denklemini kullanarak hesaplamalar yapar'],
    ['9.1.1.1', 'Biyoloji', '9', 'Canlıların ortak özelliklerini ve organizasyon düzeylerini açıklar'],
    ['9.1.1.2', 'Biyoloji', '9', 'Hücre teorisini ve hücre tiplerini (prokaryot/öekaryot) karşılaştırır'],
    ['9.1.2.1', 'Biyoloji', '9', 'Hücre organellerinin yapı ve görevlerini açıklar'],
    ['9.1.2.2', 'Biyoloji', '9', 'Hücre zarının yapısını ve geçirgenliğini inceler'],
    ['9.2.1.1', 'Biyoloji', '9', 'Enzimlerin özelliklerini ve çalışma mekanizmalarını açıklar'],
    ['9.2.2.1', 'Biyoloji', '9', 'Hücre solunumu ve fotosentez süreçlerini karşılaştırır'],
    ['9.3.1.1', 'Biyoloji', '9', 'Mitöz ve mayoz bölünmeleri karşılaştırır'],
    ['9.3.2.1', 'Biyoloji', '9', 'Mendel yasalarını ve kalıtım türlerini açıklar'],
    ['9.1.1.1', 'Türk Dili ve Edebiyatı', '9', 'Dilin tanımını, özelliklerini ve işlevlerini açıklar'],
    ['9.1.1.2', 'Türk Dili ve Edebiyatı', '9', 'Türkçenin tarihsel dönemlerini ve özelliklerini sıralar'],
    ['9.1.2.1', 'Türk Dili ve Edebiyatı', '9', 'Ses olaylarını (ünlü uyumu, ünsüz yumuşaması vb.) açıklar'],
    ['9.1.2.2', 'Türk Dili ve Edebiyatı', '9', 'Yapım eklerini ve çekim eklerini ayırt eder'],
    ['9.2.1.1', 'Türk Dili ve Edebiyatı', '9', 'Türk edebiyatı dönemlerini ve temsilcilerini tanır'],
    ['9.2.1.2', 'Türk Dili ve Edebiyatı', '9', 'Halk edebiyatı türlerini (mani, türkü, ağıt vb.) tanır'],
    ['9.3.1.1', 'Türk Dili ve Edebiyatı', '9', 'Paragraf yapısını ve paragraf türlerini analiz eder'],
    ['9.3.2.1', 'Türk Dili ve Edebiyatı', '9', 'Yaratıcı yazma becerilerini geliştirir'],
    ['9.1.1.1', 'Tarih', '9', 'Tarih biliminin tanımını, konusunu ve yardımcı bilimlerini açıklar'],
    ['9.1.1.2', 'Tarih', '9', 'Tarihsel zaman kavramını ve dönemleşmeyi anlar'],
    ['9.1.2.1', 'Tarih', '9', 'İlk çağ medeniyetlerini (Mısopotamya, Mısır, Anadolu) karşılaştırır'],
    ['9.1.2.2', 'Tarih', '9', 'Türklerin Orta Asya\'daki ilk devletlerini (Hun, Göktürk, Uygur) inceler'],
    ['9.2.1.1', 'Tarih', '9', 'İslam tarihinin kaynaklarını ve Hz. Muhammed dönemi\'ni inceler'],
    ['9.2.2.1', 'Tarih', '9', 'Emevi ve Abbasî devirlerini ve medeniyet katkılarını açıklar'],
    ['9.3.1.1', 'Tarih', '9', 'Türk-İslam devletlerini (Karahanlı, Gazneli, Büyük Selçuklu) inceler'],
    ['9.3.2.1', 'Tarih', '9', 'Anadolu Selçukluları ve beylikler dönemini analiz eder'],
    ['9.1.1.1', 'Coğrafya', '9', 'Coğrafya biliminin tanımını, alt dallarını ve yöntemlerini açıklar'],
    ['9.1.1.2', 'Coğrafya', '9', 'Harita, ölçek, projeksiyon ve harita okuma becerilerini geliştirir'],
    ['9.1.2.1', 'Coğrafya', '9', 'Dünyanın şeklini, boyutlarını ve hareketlerini açıklar'],
    ['9.1.2.2', 'Coğrafya', '9', 'Gün ve yıl uzunluğuna etkilerini, mevsim oluşumunu inceler'],
    ['9.2.1.1', 'Coğrafya', '9', 'Atmosferin yapısını, katmanlarını ve hava olaylarını açıklar'],
    ['9.2.1.2', 'Coğrafya', '9', 'İklim öğrelerini ve iklim türlerini sınıflandırır'],
    ['9.3.1.1', 'Coğrafya', '9', 'Yeryüzü şekillerinin (jeomorfoloji) oluşum süreçlerini inceler'],
    ['9.3.2.1', 'Coğrafya', '9', 'Türkiye\'nin jeolojik yapısını ve morfolojik birimlerini açıklar'],
  ];

  const stmt = db.prepare(`
    INSERT INTO achievements (id, kazanim_kodu, ders_adi, sinif_seviyesi, aciklama)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const a of achievements) {
    stmt.run([crypto.randomUUID(), ...a]);
  }
  stmt.free();
}

let _dbPromise: Promise<Database> | null = null;
export function getDbSync(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call getDb() first.");
  }
  return db;
}

export { saveDb };