const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const dataFile = process.env.DATA_FILE || path.join(root, "data", "library.json");

const seedDocuments = [
  {
    name: "Q2 Product Launch Plan.md",
    type: "Markdown",
    synced: "Just now",
    content: "The Q2 launch focuses on three priorities: ship the collaborative workspace by May 18, improve activation from 41% to 55%, and prepare the enterprise security package. The launch campaign begins May 6 with a customer webinar and partner preview. Product owns workspace delivery, Growth owns activation experiments, and Security owns the SOC 2 readiness package. The team will measure weekly active teams, time to first shared project, and enterprise demo requests."
  },
  {
    name: "Remote Work Policy.txt",
    type: "Text",
    synced: "2 min ago",
    content: "Northstar is a remote-first company. Employees may work from anywhere in their hiring country. Core collaboration hours are 10:00 to 14:00 in each team's primary timezone, Monday through Thursday. Team members can expense up to $800 for a home office setup and $75 per month for internet. In-person team gatherings happen twice per year and travel is covered by the company."
  },
  {
    name: "Enterprise Pricing 2026.csv",
    type: "CSV",
    synced: "4 min ago",
    content: "Enterprise plans begin at $36 per user per month with a 50-seat minimum and annual agreement. Volume pricing is available above 200 seats. Enterprise includes SSO, SCIM provisioning, audit logs, custom data retention, priority support, and a named customer success manager. Customers can add the advanced security package for $8 per user per month."
  },
  {
    name: "Customer Interviews — Onboarding.md",
    type: "Markdown",
    synced: "8 min ago",
    content: "Customers consistently praised the template gallery but found inviting teammates too easy to miss. Five of eight interviewees wanted sample projects populated with realistic data. New admins were unsure which permissions to choose. Recommended improvements: make team invite a clear checklist step, add role explanations, and provide a guided first project with sample content."
  },
  {
    name: "Brand Voice Guidelines.md",
    type: "Markdown",
    synced: "12 min ago",
    content: "Our voice is clear, warm, capable, and candid. Prefer short sentences and everyday words. Explain the benefit before the feature. Avoid hype, jargon, and claims we cannot prove. We should sound like a knowledgeable teammate, not a corporate announcement."
  },
  {
    name: "Security & Compliance Overview.txt",
    type: "Text",
    synced: "18 min ago",
    content: "Northstar encrypts data in transit with TLS 1.3 and at rest with AES-256. Production access requires SSO and hardware security keys. Audit logs are retained for 365 days on Enterprise plans. SOC 2 Type II renewal is scheduled for July. Customer data is backed up daily with point-in-time recovery."
  },
  {
    name: "2026 Company Goals.md",
    type: "Markdown",
    synced: "21 min ago",
    content: "The company goals for 2026 are to reach $12M ARR, maintain net revenue retention above 112%, and become the easiest collaborative workspace to adopt. The operating plan prioritizes enterprise readiness, faster onboarding, and international expansion into the UK and Australia."
  },
  {
    name: "Support Escalation Guide.txt",
    type: "Text",
    synced: "30 min ago",
    content: "Severity 1 issues include full service outage, confirmed data loss, or a critical security incident. Page the on-call engineer immediately and update the customer every 30 minutes. Severity 2 issues receive a response within two hours. All escalations require an incident channel and a written retrospective."
  }
];

const demoDocumentNames = new Set(seedDocuments.map(document => document.name));
seedDocuments.length = 0;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

async function ensureLibrary() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const state = JSON.parse(raw);
    if (!Array.isArray(state.documents)) {
      const initial = { documents: seedDocuments, connectedFolders: [] };
      await fs.writeFile(dataFile, JSON.stringify(initial, null, 2));
      return initial;
    }
    const filtered = {
      documents: state.documents.filter(document => !demoDocumentNames.has(document.name)).map(sanitizeStoredDocument),
      connectedFolders: Array.isArray(state.connectedFolders) ? state.connectedFolders : []
    };
    if (JSON.stringify(filtered) !== JSON.stringify(state)) {
      await fs.writeFile(dataFile, JSON.stringify(filtered, null, 2));
      return filtered;
    }
    return state;
  } catch {
    const initial = { documents: seedDocuments, connectedFolders: [] };
    await fs.writeFile(dataFile, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function handleApi(request, response) {
  if (request.url !== "/api/library") {
    return sendJson(response, 404, { error: "Not found" });
  }

  if (request.method === "GET") {
    return sendJson(response, 200, await ensureLibrary());
  }

  if (request.method === "PUT") {
    const body = JSON.parse(await readBody(request));
    if (!Array.isArray(body.documents) || !Array.isArray(body.connectedFolders)) {
      return sendJson(response, 400, { error: "Invalid library state" });
    }
    const state = {
      documents: body.documents.map(document => sanitizeStoredDocument({
        name: String(document.name || "Untitled"),
        type: String(document.type || "Document"),
        synced: String(document.synced || "Just now"),
        content: String(document.content || ""),
        driveFolder: document.driveFolder ? String(document.driveFolder) : undefined,
        isUpload: Boolean(document.isUpload)
      })),
      connectedFolders: body.connectedFolders.map(folder => String(folder))
    };
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(state, null, 2));
    return sendJson(response, 200, state);
  }

  return sendJson(response, 405, { error: "Method not allowed" });
}

function sanitizeStoredDocument(document) {
  if (document.type === "PDF document" && document.content && !isReadableText(document.content)) {
    return {
      ...document,
      content: `${document.name} needs to be re-uploaded. The previous PDF text extraction saved compressed PDF data instead of readable document text. Upload it again so Atlas can use OCR to scan the full document.`
    };
  }
  return document;
}

function isReadableText(text) {
  if (!text || text.trim().length < 20) return false;
  const cleaned = text.replace(/\s+/g, " ").trim();
  const printable = (cleaned.match(/[A-Za-z0-9 .,;:!?'"()/$%&+\-\n]/g) || []).length;
  const letters = (cleaned.match(/[A-Za-z]/g) || []).length;
  const suspicious = (cleaned.match(/[^\x09\x0A\x0D\x20-\x7E£€–—‘’“”]/g) || []).length;
  return printable / cleaned.length > 0.82 && letters / cleaned.length > 0.18 && suspicious / cleaned.length < 0.04;
}

async function handleStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root) || filePath.includes(`${path.sep}.git${path.sep}`)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) return await handleApi(request, response);
    return await handleStatic(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Knowledge Bank Assistant running on http://localhost:${port}`);
});
