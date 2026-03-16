require("dotenv").config();

const BASE_URL = process.env.EVOLUTION_BASE_URL;
const INSTANCE = process.env.EVOLUTION_INSTANCE;
const API_KEY = process.env.EVOLUTION_API_KEY;

async function test() {
  console.log("🔍 Testando Evolution API...");
  console.log(`URL: ${BASE_URL}`);
  console.log(`Instance: ${INSTANCE}\n`);

  // 1. verifica se a instância existe e está conectada
  try {
    const res = await fetch(`${BASE_URL}/instance/fetchInstances`, {
      headers: { apikey: API_KEY },
    });
    const data = await res.json();
    console.log("📋 Instâncias encontradas:");
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("❌ Erro ao buscar instâncias:", e.message);
    return;
  }

  // 2. verifica status de conexão da instância
  try {
    const res = await fetch(
      `${BASE_URL}/instance/connectionState/${INSTANCE}`,
      {
        headers: { apikey: API_KEY },
      },
    );
    const data = await res.json();
    console.log("\n📡 Status da instância:");
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("❌ Erro ao verificar status:", e.message);
  }
}

test();
