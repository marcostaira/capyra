const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:18789");

ws.on("open", () => {
  console.log("✅ Conectado ao Gateway");

  // 1. registra a sessão
  ws.send(
    JSON.stringify({
      type: "register",
      payload: {
        channel: "test",
        channelId: "user-123",
        workspace: "default",
      },
    }),
  );
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  console.log("📨 Gateway respondeu:", JSON.stringify(msg, null, 2));

  // 2. depois de registrado, manda uma mensagem
  if (msg.type === "registered") {
    console.log("\n💬 Enviando mensagem de teste...\n");
    ws.send(
      JSON.stringify({
        type: "message",
        payload: {
          content: "Hello! What can you do?",
        },
      }),
    );
  }

  // 3. quando receber resposta do agente, encerra
  if (msg.type === "message") {
    console.log("\n🦫 Agente respondeu:", msg.payload.content);
    ws.close();
  }
});

ws.on("close", () => {
  console.log("\n🔌 Conexão encerrada");
});

ws.on("error", (err) => {
  console.error("❌ Erro:", err.message);
});
