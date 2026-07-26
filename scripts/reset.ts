import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.VESPER_DATA_DIR ?? path.join(process.cwd(), ".data");

for (const f of ["vesper.db", "vesper.db-wal", "vesper.db-shm"]) {
  const p = path.join(DATA_DIR, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log(`· removed ${f}`);
  }
}
console.log("✓ database reset. Run `npm run db:seed` to repopulate.");
