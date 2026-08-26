import { getDb } from "@/lib/db/database";

async function main() {
  console.log("Veritabanı başlatılıyor...");
  await getDb();
  console.log("Veritabanı hazır!");
  process.exit(0);
}

main().catch(err => {
  console.error("Veritabanı başlatma hatası:", err);
  process.exit(1);
});