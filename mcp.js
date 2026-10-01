// MCP untuk agent: akses aplikasi undangan di server ini.
// Aktif hanya jika MCP_TOKEN diisi. Tidak bisa keluar dari folder aplikasi.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const PROTOCOL = "2025-06-18";
const MAX_OUT = 80_000;
const MAX_WRITE = 500_000;

function safeJoin(root, rel) {
  const clean = path.normalize(String(rel || '')).replace(/^([.][.][\/])+/, '');
  if (!clean || clean.includes(String.fromCharCode(0)) || clean.split(path.sep).includes('..')) {
    throw new Error("Path tidak valid.");
  }
  const abs = path.resolve(root, clean);
  const base = path.resolve(root);
  if (abs !== base && !abs.startsWith(base + path.sep)) throw new Error("Path di luar aplikasi.");
  return abs;
}

function clip(text) {
  const s = String(text ?? "");
  return s.length > MAX_OUT ? s.slice(0, MAX_OUT) + "\n...(terpotong)" : s;
}

function walk(root, dir, out, depth) {
  if (depth > 8 || out.length > 800) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const abs = path.join(dir, ent.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (ent.isDirectory()) {
      out.push(rel + "/");
      walk(root, abs, out, depth + 1);
    } else {
      out.push(rel);
    }
  }
}

function toolList() {
  return [
    {
      name: "list_files",
      description: "Daftar semua file aplikasi undangan, termasuk data dan upload.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "read_file",
      description: "Baca file di dalam aplikasi. Path relatif, contoh public/js/app.js atau .env.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          start_line: { type: "integer" },
          end_line: { type: "integer" },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Tulis atau buat file di dalam aplikasi.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
    {
      name: "replace_in_file",
      description: "Ganti teks yang cocok persis sekali di satu file aplikasi.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_text: { type: "string" },
          new_text: { type: "string" },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
    {
      name: "run",
      description: "Jalankan perintah di dalam folder aplikasi. Tidak bisa keluar dari aplikasi. Contoh: node -e, npm, ls.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
          args: { type: "array", items: { type: "string" } },
        },
        required: ["command"],
      },
    },
  ];
}

function callTool(root, name, args) {
  if (name === "list_files") {
    const files = [];
    walk(root, root, files, 0);
    return files.sort().join("\n") || "(kosong)";
  }
  if (name === "read_file") {
    const abs = safeJoin(root, args.path);
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return "(file biner, " + buf.length + " byte, tidak ditampilkan)";
    const lines = buf.toString("utf8").split(/\r?\n/);
    const start = Math.max(1, Number(args.start_line || 1));
    const end = Math.min(lines.length, Number(args.end_line || lines.length));
    return clip(lines.slice(start - 1, end).map((l, i) => (start + i) + "|" + l).join("\n"));
  }
  if (name === "write_file") {
    const content = String(args.content ?? "");
    if (content.length > MAX_WRITE) throw new Error("Isi terlalu besar.");
    const abs = safeJoin(root, args.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    return "Tersimpan: " + args.path;
  }
  if (name === "replace_in_file") {
    const abs = safeJoin(root, args.path);
    const cur = fs.readFileSync(abs, "utf8");
    const oldText = String(args.old_text ?? "");
    if (!oldText) throw new Error("old_text kosong.");
    const hits = cur.split(oldText).length - 1;
    if (hits !== 1) throw new Error("old_text cocok " + hits + " kali, harus tepat 1.");
    const next = cur.replace(oldText, String(args.new_text ?? ""));
    if (next.length > MAX_WRITE) throw new Error("Hasil terlalu besar.");
    fs.writeFileSync(abs, next);
    return "Diubah: " + args.path;
  }
  if (name === "run") return runCmd(root, args);
  throw new Error("Tool tidak dikenal.");
}

function runCmd(root, args) {
  const command = String(args.command || "").trim();
  if (!command || command.includes("\0")) throw new Error("Perintah kosong.");
  const argv = Array.isArray(args.args) ? args.args.map(String) : [];
  return new Promise((resolve) => {
    execFile(command, argv, {
      cwd: root,
      timeout: 20_000,
      maxBuffer: 1_000_000,
      windowsHide: true,
      env: process.env,
    }, (err, stdout, stderr) => {
      const head = err ? ("exit " + (err.code ?? 1) + "\n") : "";
      resolve(clip(head + String(stdout || "") + String(stderr || "")));
    });
  });
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessage(root, msg, session) {
  const { id, method, params } = msg || {};
  if (!method) return rpcError(id ?? null, -32600, "Bukan JSON-RPC.");
  if (method === "initialize") {
    session.ready = true;
    return rpcResult(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "undangan", version: "1.0.0" },
      instructions: "Akses penuh aplikasi undangan di folder ini: kode, data, upload, dan perintah. Jangan menganggap bisa keluar dari container aplikasi.",
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (method === "ping") return rpcResult(id, {});
  if (!session.ready) return rpcError(id ?? null, -32002, "Belum initialize.");
  if (method === "tools/list") return rpcResult(id, { tools: toolList() });
  if (method === "tools/call") {
    try {
      const text = await callTool(root, params?.name, params?.arguments || {});
      return rpcResult(id, { content: [{ type: "text", text: String(text) }], isError: false });
    } catch (err) {
      return rpcResult(id, { content: [{ type: "text", text: err.message || "Gagal." }], isError: true });
    }
  }
  if (method === "resources/list") return rpcResult(id, { resources: [] });
  if (method === "prompts/list") return rpcResult(id, { prompts: [] });
  return rpcError(id ?? null, -32601, "Method tidak didukung: " + method);
}

function tokenOk(given, token) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function mountMcp(app, root) {
  const token = String(process.env.MCP_TOKEN || "").trim();
  if (!token) {
    console.log("MCP nonaktif. Isi MCP_TOKEN untuk mengaktifkan /mcp.");
    return;
  }
  const sessions = new Map();

  app.post("/mcp", async (req, res) => {
    const origin = req.get("origin");
    if (origin && origin !== "null") {
      try {
        if (new URL(origin).host !== req.get("host")) return res.status(403).json({ error: "Origin ditolak." });
      } catch {
        return res.status(403).json({ error: "Origin tidak valid." });
      }
    }
    const auth = String(req.get("authorization") || "");
    const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!tokenOk(given, token)) return res.status(401).json({ error: "Token MCP salah." });

    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json(rpcError(null, -32600, "Body harus satu objek JSON-RPC."));
    }
    let sid = String(req.get("mcp-session-id") || "");
    if (body.method === "initialize") {
      sid = crypto.randomUUID();
      sessions.set(sid, { ready: false, at: Date.now() });
      res.set("Mcp-Session-Id", sid);
    }
    const session = sessions.get(sid);
    if (!session) return res.status(400).json(rpcError(body.id ?? null, -32001, "Kirim initialize dulu."));
    session.at = Date.now();
    const out = await handleMessage(root, body, session);
    if (!out) return res.status(202).end();
    res.json(out);
  });

  app.delete("/mcp", (req, res) => {
    sessions.delete(String(req.get("mcp-session-id") || ""));
    res.status(200).json({ ok: true });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessions) if (now - s.at > 60 * 60 * 1000) sessions.delete(sid);
  }, 10 * 60 * 1000).unref();

  console.log("MCP aktif di /mcp");
}
