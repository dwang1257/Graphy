#!/usr/bin/env node
/**
 * Temporary terminal logger for Graphy's custom-testcase aggregate buffer.
 * Run: node scripts/debug-buffer-server.mjs
 */
import http from "node:http";

const PORT = 7921;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/graphy-buffer") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const stamp = new Date(body.at ?? Date.now()).toLocaleTimeString();
        console.log("\n========== Graphy custom test collection ==========");
        console.log(`time: ${stamp}`);
        console.log(`case tabs: ${body.caseTags ?? "?"}   param fields: ${body.params ?? "?"}`);
        console.log("----- buffer (exact text Graphy captured) -----");
        console.log(body.buffer === "" ? "(empty)" : body.buffer);
        console.log("===================================================\n");
      } catch (error) {
        console.error("bad payload", error);
      }
      res.writeHead(204);
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Graphy buffer logger listening on http://127.0.0.1:${PORT}/graphy-buffer`);
  console.log("Reload the extension, refresh LeetCode, then edit a custom test case.\n");
});
