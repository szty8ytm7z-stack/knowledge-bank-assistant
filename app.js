const seedDocuments = [
  {
    name: "Q2 Product Launch Plan.md", type: "Markdown", synced: "Just now",
    content: "The Q2 launch focuses on three priorities: ship the collaborative workspace by May 18, improve activation from 41% to 55%, and prepare the enterprise security package. The launch campaign begins May 6 with a customer webinar and partner preview. Product owns workspace delivery, Growth owns activation experiments, and Security owns the SOC 2 readiness package. The team will measure weekly active teams, time to first shared project, and enterprise demo requests."
  },
  {
    name: "Remote Work Policy.txt", type: "Text", synced: "2 min ago",
    content: "Northstar is a remote-first company. Employees may work from anywhere in their hiring country. Core collaboration hours are 10:00 to 14:00 in each team's primary timezone, Monday through Thursday. Team members can expense up to $800 for a home office setup and $75 per month for internet. In-person team gatherings happen twice per year and travel is covered by the company."
  },
  {
    name: "Enterprise Pricing 2026.csv", type: "CSV", synced: "4 min ago",
    content: "Enterprise plans begin at $36 per user per month with a 50-seat minimum and annual agreement. Volume pricing is available above 200 seats. Enterprise includes SSO, SCIM provisioning, audit logs, custom data retention, priority support, and a named customer success manager. Customers can add the advanced security package for $8 per user per month."
  },
  {
    name: "Customer Interviews — Onboarding.md", type: "Markdown", synced: "8 min ago",
    content: "Customers consistently praised the template gallery but found inviting teammates too easy to miss. Five of eight interviewees wanted sample projects populated with realistic data. New admins were unsure which permissions to choose. Recommended improvements: make team invite a clear checklist step, add role explanations, and provide a guided first project with sample content."
  },
  {
    name: "Brand Voice Guidelines.md", type: "Markdown", synced: "12 min ago",
    content: "Our voice is clear, warm, capable, and candid. Prefer short sentences and everyday words. Explain the benefit before the feature. Avoid hype, jargon, and claims we cannot prove. We should sound like a knowledgeable teammate, not a corporate announcement."
  },
  {
    name: "Security & Compliance Overview.txt", type: "Text", synced: "18 min ago",
    content: "Northstar encrypts data in transit with TLS 1.3 and at rest with AES-256. Production access requires SSO and hardware security keys. Audit logs are retained for 365 days on Enterprise plans. SOC 2 Type II renewal is scheduled for July. Customer data is backed up daily with point-in-time recovery."
  },
  {
    name: "2026 Company Goals.md", type: "Markdown", synced: "21 min ago",
    content: "The company goals for 2026 are to reach $12M ARR, maintain net revenue retention above 112%, and become the easiest collaborative workspace to adopt. The operating plan prioritizes enterprise readiness, faster onboarding, and international expansion into the UK and Australia."
  },
  {
    name: "Support Escalation Guide.txt", type: "Text", synced: "30 min ago",
    content: "Severity 1 issues include full service outage, confirmed data loss, or a critical security incident. Page the on-call engineer immediately and update the customer every 30 minutes. Severity 2 issues receive a response within two hours. All escalations require an incident channel and a written retrospective."
  }
];

const savedLibrary = loadLibraryState();
let documents = savedLibrary?.documents || [...seedDocuments];
let activeSources = [];
let connectedFolders = savedLibrary?.connectedFolders || [];
let latestUploadedDocument = documents.find(doc => doc.isUpload) || null;
let libraryUnlocked = false;
let pendingDeleteIndex = null;
let recentQuestions = loadRecentQuestions();

const driveFolderDocuments = {
  "Product & Strategy": [
    { name: "Product Roadmap H2 2026.gdoc", type: "Google Doc", content: "The H2 product roadmap prioritizes advanced search, automated knowledge syncing, and reusable workspace templates. Search quality is measured by answer acceptance rate and successful source citations." },
    { name: "Weekly Product Review.gdoc", type: "Google Doc", content: "This week's product review approved the Google Drive folder connector for beta. The beta should support folder-level access, incremental syncing, and clear source attribution." }
  ],
  "Company Handbook": [
    { name: "Benefits & Time Off.gdoc", type: "Google Doc", content: "Employees receive 25 days of flexible paid time off each year. New parents receive 16 weeks of paid parental leave. The company also provides an annual learning budget of $1,500." },
    { name: "Travel Policy.gdoc", type: "Google Doc", content: "Book economy travel for trips under six hours. Hotels should generally remain below $250 per night. Submit expenses within 30 days of travel." }
  ],
  "Customer Research": [
    { name: "Enterprise Research Synthesis.gdoc", type: "Google Doc", content: "Enterprise buyers value trustworthy citations, permission-aware search, and fast onboarding. Their main concern is knowing which files the assistant can access." },
    { name: "Search Beta Feedback.gdoc", type: "Google Doc", content: "Beta users described source previews as the most important trust feature. They asked for Drive folder syncing and a way to exclude individual files." }
  ]
};

function loadLibraryState() {
  try {
    return JSON.parse(localStorage.getItem("atlas-library-state"));
  } catch {
    return null;
  }
}

function saveLibraryState() {
  try {
    localStorage.setItem("atlas-library-state", JSON.stringify({ documents, connectedFolders }));
  } catch {
    showToast("Library changes could not be saved in this browser");
  }
}

function loadRecentQuestions() {
  try {
    return JSON.parse(localStorage.getItem("atlas-recent-questions")) || [];
  } catch {
    return [];
  }
}

function saveRecentQuestions() {
  try {
    localStorage.setItem("atlas-recent-questions", JSON.stringify(recentQuestions));
  } catch {
    showToast("Recent questions could not be saved in this browser");
  }
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const chatView = $("#chatView");
const libraryView = $("#libraryView");
const conversation = $("#conversation");
const welcome = $("#welcome");
const questionInput = $("#questionInput");

function tokenize(text) {
  const stop = new Set(["the","a","an","and","or","of","to","in","is","are","our","we","what","how","for","on","with","does","do","about","from","it"]);
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2 && !stop.has(word));
}

function searchDocuments(question) {
  const refersToCurrentDocument = /\b(this|the|uploaded|latest)\s+(report|document|file|spreadsheet|workbook)\b/i.test(question);
  if (refersToCurrentDocument) return [{ ...(latestUploadedDocument || documents[0]), score: 10 }];
  const terms = tokenize(question);
  return documents.map(doc => {
    const words = tokenize(`${doc.name} ${doc.content}`);
    const score = terms.reduce((sum, term) => sum + words.filter(word => word === term).length, 0);
    return { ...doc, score };
  }).filter(doc => doc.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

function buildAnswer(question, sources) {
  if (!sources.length) {
    return `<p>I couldn't find a grounded answer in the connected sources. Try using a more specific term, or add a source containing the information you need.</p>`;
  }

  const wantsBreakdown = /\b(breakdown|break down|summari[sz]e|analyse|analyze|simplif|overview)\b/i.test(question)
    || (/\b(what does|what is|explain|about)\b/i.test(question) && /\b(report|document|file|spreadsheet|workbook|this|it)\b/i.test(question));
  if (wantsBreakdown && sources.length) return buildDocumentBreakdown(sources[0]);

  const terms = tokenize(question);
  let candidates = [];
  sources.forEach((source, sourceIndex) => {
    splitSentences(source.content).forEach(sentence => {
      const lower = sentence.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
      candidates.push({ sentence: sentence.trim(), sourceIndex, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates.filter(item => item.score > 0).slice(0, 4);
  if (!selected.length) selected.push(...candidates.slice(0, 3));

  const intro = sources.length === 1
    ? `Based on <strong>${escapeHtml(sources[0].name)}</strong>, here’s what the source says:`
    : `I found a grounded answer across ${sources.length} relevant sources:`;
  return `<p>${intro}</p><ul>${selected.map(item =>
    `<li>${escapeHtml(item.sentence)} <button class="citation" data-source="${item.sourceIndex}">${item.sourceIndex + 1}</button></li>`
  ).join("")}</ul>`;
}

function buildDocumentBreakdown(source) {
  const sentences = splitSentences(source.content).map(sentence => sentence.trim()).filter(sentence => sentence.length > 25);
  const keyPoints = sentences.slice(0, 6);
  const figures = [...new Set((source.content.match(/(?:[$£€]\s?\d[\d,.]*|\d[\d,.]*\s?%|\b\d{1,4}(?:,\d{3})+\b)/g) || []))].slice(0, 8);
  const simplePoints = keyPoints.slice(0, 3).map(sentence => {
    return sentence
      .replace(/\butili[sz]e\b/gi, "use")
      .replace(/\bapproximately\b/gi, "about")
      .replace(/\bcommence\b/gi, "start")
      .replace(/\bprioriti[sz]e\b/gi, "focus on");
  });
  return `
    <div class="analysis-banner"><span>✦</span><span><strong>Full document analysis</strong><small>${escapeHtml(source.name)}</small></span></div>
    <h3>What the report is about</h3>
    <p>${escapeHtml(keyPoints[0] || source.content.slice(0, 300))} <button class="citation" data-source="0">1</button></p>
    <h3>Key findings and details</h3>
    <ul>${keyPoints.map(point => `<li>${escapeHtml(point)} <button class="citation" data-source="0">1</button></li>`).join("")}</ul>
    ${figures.length ? `<h3>Notable figures</h3><div class="figure-chips">${figures.map(figure => `<span>${escapeHtml(figure)}</span>`).join("")}</div>` : ""}
    <div class="simple-version"><h3>Simplified version</h3><p>In plain language, this document says:</p><ul>${simplePoints.map(point => `<li>${escapeHtml(point)}</li>`).join("")}</ul></div>
  `;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
}

function ask(question) {
  question = question.trim();
  if (!question) return;
  setView("chat");
  welcome.style.display = "none";
  conversation.insertAdjacentHTML("beforeend", `<div class="message user-message"><div class="user-bubble">${escapeHtml(question)}</div></div>`);
  conversation.insertAdjacentHTML("beforeend", `<div class="message answer-message thinking-message"><div class="answer-head"><span class="mini-mark">✦</span><span><strong>Atlas</strong><small>Searching connected knowledge</small></span></div><div class="thinking"><span></span><span></span><span></span></div></div>`);
  questionInput.value = "";
  resizeTextarea();
  scrollChat();

  window.setTimeout(() => {
    activeSources = searchDocuments(question);
    const answer = buildAnswer(question, activeSources);
    $(".thinking-message").remove();
    conversation.insertAdjacentHTML("beforeend", `
      <div class="message answer-message">
        <div class="answer-head"><span class="mini-mark">✦</span><span><strong>Atlas</strong><small>Answered from your sources</small></span></div>
        <div class="answer-body">${answer}</div>
        <div class="answer-actions">
          <button class="copy-answer">Copy</button><button>Helpful</button><button>Not quite</button>
          <span class="used-sources">${activeSources.length ? `${activeSources.length} source${activeSources.length > 1 ? "s" : ""} used` : "No matching sources"}</span>
        </div>
      </div>`);
    renderDrawer(activeSources);
    bindDynamicActions();
    scrollChat();
    addHistory(question);
  }, 650);
}

function bindDynamicActions() {
  $$(".citation").forEach(button => button.onclick = () => openDrawer(Number(button.dataset.source)));
  $$(".copy-answer").forEach(button => button.onclick = () => {
    const text = button.closest(".answer-message").querySelector(".answer-body").innerText;
    navigator.clipboard?.writeText(text);
    showToast("Answer copied");
  });
}

function renderDrawer(sources) {
  if (!sources.length) {
    $("#drawerBody").innerHTML = `<div class="empty-drawer"><span>⌕</span><h3>No matching sources</h3><p>Add more raw data or try a different search.</p></div>`;
    return;
  }
  $("#drawerBody").innerHTML = sources.map((source, index) => `
    <article class="source-card" data-card="${index}">
      <div class="source-card-top"><span class="source-number">${index + 1}</span><span><strong>${escapeHtml(source.name)}</strong><small>${source.type} · Relevance ${Math.min(99, 70 + source.score * 3)}%</small></span></div>
      <p>${escapeHtml(source.content)}</p>
    </article>`).join("");
}

function openDrawer(sourceIndex) {
  $("#sourceDrawer").classList.add("open");
  $("#sourceDrawer").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("show");
  if (Number.isInteger(sourceIndex)) {
    window.setTimeout(() => $(`[data-card="${sourceIndex}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }
}

function closePanels() {
  $("#sourceDrawer").classList.remove("open");
  $("#sourceDrawer").setAttribute("aria-hidden", "true");
  $("#sidebar").classList.remove("open");
  $("#driveModal").classList.remove("open");
  $("#driveModal").setAttribute("aria-hidden", "true");
  $("#lockModal").classList.remove("open");
  $("#lockModal").setAttribute("aria-hidden", "true");
  $("#deleteModal").classList.remove("open");
  $("#deleteModal").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("show");
}

function renderFiles(filter = "") {
  const shown = documents.filter(doc => doc.name.toLowerCase().includes(filter.toLowerCase()));
  $("#fileList").innerHTML = shown.map(doc => `
    <div class="file-row">
      <span class="file-name"><span class="file-icon">${doc.type.slice(0, 3).toUpperCase()}</span>${highlight(doc.name, filter)}</span>
      <span>${doc.type}</span><span>${doc.synced}</span><button class="delete-file" data-index="${documents.indexOf(doc)}" title="Delete ${escapeHtml(doc.name)}" aria-label="Delete ${escapeHtml(doc.name)}">×</button>
    </div>`).join("");
  $$(".delete-file").forEach(button => button.onclick = () => openDeleteModal(Number(button.dataset.index)));
  updateCounts();
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const safe = escapeHtml(text);
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${pattern})`, "ig"), "<mark>$1</mark>");
}

function updateCounts() {
  $("#navDocCount").textContent = documents.length;
  const sourceCount = $("#sourceCount");
  if (sourceCount) sourceCount.textContent = documents.length;
  $("#indexedCount").textContent = `${documents.length} docs`;
  $("#storageProgress").style.width = `${Math.min(100, 18 + documents.length * 3)}%`;
}

function showDriveStep(id) {
  $$(".drive-step").forEach(step => step.classList.toggle("active", step.id === id));
}

function openDriveModal() {
  showDriveStep("driveAuthStep");
  $("#driveModal").classList.add("open");
  $("#driveModal").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("show");
}

function closeDriveModal() {
  $("#driveModal").classList.remove("open");
  $("#driveModal").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("show");
}

function openLockModal() {
  $("#libraryPassword").value = "";
  $("#libraryPassword").classList.remove("invalid");
  $("#passwordError").classList.remove("show");
  $("#lockModal").classList.add("open");
  $("#lockModal").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("show");
  window.setTimeout(() => $("#libraryPassword").focus(), 100);
}

function openDeleteModal(index) {
  pendingDeleteIndex = index;
  const document = documents[index];
  if (!document) return;
  $("#deleteMessage").textContent = `${document.name} will be removed from the Knowledge Library and Atlas will no longer use it for answers.`;
  $("#deleteModal").classList.add("open");
  $("#deleteModal").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("show");
}

function deletePendingFile() {
  const document = documents[pendingDeleteIndex];
  if (!document) return closePanels();
  documents.splice(pendingDeleteIndex, 1);
  if (latestUploadedDocument === document) latestUploadedDocument = null;
  if (document.driveFolder && !documents.some(doc => doc.driveFolder === document.driveFolder)) {
    connectedFolders = connectedFolders.filter(folder => folder !== document.driveFolder);
  }
  activeSources = activeSources.filter(source => source.name !== document.name);
  saveLibraryState();
  renderFiles($("#librarySearch").value);
  renderConnections();
  closePanels();
  showToast(`${document.name} deleted`);
}

function renderConnections() {
  if (!connectedFolders.length) {
    $("#connections").innerHTML = `<div class="connection-empty">
      <span class="google-drive-mark large">▲</span>
      <span><strong>Bring in a Google Drive folder</strong><small>Atlas will index supported files and keep the folder in sync.</small></span>
      <button id="emptyConnectDrive">Connect folder</button>
    </div>`;
    $("#emptyConnectDrive").onclick = openDriveModal;
    return;
  }
  $("#connections").innerHTML = connectedFolders.map(name => {
    const count = documents.filter(doc => doc.driveFolder === name).length;
    return `<div class="connection-card">
      <span class="google-drive-mark large">▲</span>
      <span><strong>${escapeHtml(name)}</strong><small class="connection-status">Connected · ${count} files indexed · Syncing automatically</small></span>
      <button class="connection-menu" title="Connection options">•••</button>
    </div>`;
  }).join("");
}

function connectDriveFolder(name) {
  if (connectedFolders.includes(name)) {
    closeDriveModal();
    showToast(`${name} is already connected`);
    return;
  }
  showDriveStep("syncStep");
  $("#syncFolderName").textContent = `Reading files from ${name}`;
  window.setTimeout(() => {
    const newDocuments = driveFolderDocuments[name] || [
      { name: `${name} — Drive Notes.gdoc`, type: "Google Doc", content: `This document was synced from the connected Google Drive folder named ${name}. Atlas can now search and cite its contents.` }
    ];
    newDocuments.forEach(doc => documents.unshift({ ...doc, synced: "Just now", driveFolder: name }));
    connectedFolders.push(name);
    saveLibraryState();
    renderFiles($("#librarySearch").value);
    renderConnections();
    closeDriveModal();
    showToast(`${name} connected · ${newDocuments.length} files indexed`);
  }, 1250);
}

function setView(view) {
  if (view === "library" && !libraryUnlocked) {
    closePanels();
    openLockModal();
    return;
  }
  const isChat = view === "chat";
  chatView.classList.toggle("active-view", isChat);
  libraryView.classList.toggle("active-view", !isChat);
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  closePanels();
}

function addHistory(question) {
  recentQuestions = [question, ...recentQuestions.filter(item => item !== question)].slice(0, 20);
  saveRecentQuestions();
  renderHistory($("#historySearch").value);
}

function renderHistory(filter = "") {
  const query = filter.trim().toLowerCase();
  const shown = recentQuestions.filter(question => question.toLowerCase().includes(query));
  $("#historyList").innerHTML = shown.length
    ? shown.map(question => `<button class="history-item" data-question="${escapeHtml(question)}" title="${escapeHtml(question)}">${highlight(question, filter)}</button>`).join("")
    : `<div class="history-empty">${query ? "No matching questions" : "No recent questions yet"}</div>`;
  $$("#historyList .history-item").forEach(button => button.onclick = () => ask(button.dataset.question));
  $("#clearHistoryBtn").classList.toggle("show", recentQuestions.length >= 7);
}

function clearHistory() {
  recentQuestions = [];
  saveRecentQuestions();
  renderHistory();
  showToast("Recent questions deleted");
}

function resizeTextarea() {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 110)}px`;
}

function scrollChat() {
  $("#chatScroll").scrollTop = $("#chatScroll").scrollHeight;
}

function showToast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  window.setTimeout(() => $("#toast").classList.remove("show"), 1800);
}

async function ingestFiles(files) {
  const allowed = ["xlsx", "xls", "docx", "doc", "pdf"];
  const typeNames = {
    xlsx: "Excel", xls: "Excel",
    docx: "Word document", doc: "Word document",
    pdf: "PDF document"
  };
  let added = 0;
  let rejected = 0;
  for (const file of files) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(extension)) {
      rejected++;
      continue;
    }
    showToast(`Analyzing ${file.name}…`);
    const extracted = await extractDocumentText(file, extension);
    const document = {
      name: file.name,
      type: typeNames[extension],
      synced: "Just now",
      isUpload: true,
      content: extracted || `${file.name} was uploaded, but its text could not be extracted in this browser. Try a modern DOCX, XLSX, or text-based PDF.`
    };
    documents.unshift(document);
    latestUploadedDocument = document;
    added++;
  }
  saveLibraryState();
  renderFiles($("#librarySearch").value);
  if (added) {
    showToast(`${added} file${added > 1 ? "s" : ""} indexed${rejected ? ` · ${rejected} unsupported` : ""}`);
  } else {
    showToast("Only Excel, Word, and PDF documents are supported");
  }
}

async function extractDocumentText(file, extension) {
  try {
    const buffer = await file.arrayBuffer();
    if (extension === "docx") return extractDocxText(buffer);
    if (extension === "xlsx") return extractXlsxText(buffer);
    if (extension === "pdf") return extractPdfText(buffer);
    return extractReadableStrings(buffer);
  } catch (error) {
    console.warn("Document extraction failed", error);
    return "";
  }
}

async function unzipEntries(buffer) {
  const view = new DataView(buffer);
  let end = view.byteLength - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) return {};
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries = {};
  for (let index = 0; index < count; index++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, cursor + 46, nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = new Uint8Array(buffer.slice(dataStart, dataStart + compressedSize));
    let bytes = compressed;
    if (method === 8) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if (method === 0 || method === 8) entries[name] = new TextDecoder().decode(bytes);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function xmlText(xml, tagName = "t") {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.getElementsByTagName(tagName)].map(node => node.textContent.trim()).filter(Boolean).join(" ");
}

async function extractDocxText(buffer) {
  const entries = await unzipEntries(buffer);
  const xml = entries["word/document.xml"];
  if (!xml) return "";
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.getElementsByTagName("w:p")].map(paragraph =>
    [...paragraph.getElementsByTagName("w:t")].map(node => node.textContent).join("")
  ).filter(Boolean).join(". ");
}

async function extractXlsxText(buffer) {
  const entries = await unzipEntries(buffer);
  const shared = entries["xl/sharedStrings.xml"]
    ? [...new DOMParser().parseFromString(entries["xl/sharedStrings.xml"], "application/xml").getElementsByTagName("si")].map(node => node.textContent.trim())
    : [];
  const rows = [];
  Object.keys(entries).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).forEach(name => {
    const doc = new DOMParser().parseFromString(entries[name], "application/xml");
    [...doc.getElementsByTagName("row")].forEach(row => {
      const values = [...row.getElementsByTagName("c")].map(cell => {
        const value = cell.getElementsByTagName("v")[0]?.textContent || cell.textContent.trim();
        return cell.getAttribute("t") === "s" ? shared[Number(value)] || value : value;
      }).filter(Boolean);
      if (values.length) rows.push(values.join(" | "));
    });
  });
  return rows.join(". ");
}

function extractPdfText(buffer) {
  const raw = new TextDecoder("latin1").decode(buffer);
  const pieces = [...raw.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*(?:Tj|'|")/g)].map(match =>
    match[1].replace(/\\([()\\])/g, "$1").replace(/\\n/g, " ")
  );
  return pieces.join(" ").replace(/\s+/g, " ").trim() || extractReadableStrings(buffer);
}

function extractReadableStrings(buffer) {
  return new TextDecoder("latin1").decode(buffer).match(/[A-Za-z][A-Za-z0-9 ,.;:$%()'"/-]{20,}/g)?.join(" ") || "";
}

$("#askForm").addEventListener("submit", event => { event.preventDefault(); ask(questionInput.value); });
questionInput.addEventListener("input", resizeTextarea);
questionInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(questionInput.value); }
});
$$(".nav-item").forEach(button => button.onclick = () => setView(button.dataset.view));
$("#newThreadBtn").onclick = () => {
  conversation.innerHTML = "";
  welcome.style.display = "";
  setView("chat");
  questionInput.focus();
};
$("#sourcesButton")?.addEventListener("click", () => openDrawer());
$("#closeDrawer").onclick = closePanels;
$("#scrim").onclick = closePanels;
$("#mobileMenu").onclick = () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); };
$("#uploadButton").onclick = () => $("#fileInput").click();
$("#uploadFromComposer").onclick = () => $("#fileInput").click();
$("#fileInput").onchange = event => ingestFiles([...event.target.files]);
$("#librarySearch").oninput = event => renderFiles(event.target.value);
$("#historySearch").oninput = event => renderHistory(event.target.value);
$("#clearHistoryBtn").onclick = clearHistory;
$("#connectDriveButton").onclick = openDriveModal;
$("#emptyConnectDrive").onclick = openDriveModal;
$("#closeDriveModal").onclick = closeDriveModal;
$("#authorizeDrive").onclick = () => showDriveStep("folderStep");
$("#backToAuth").onclick = () => showDriveStep("driveAuthStep");
$$(".folder-option").forEach(button => button.onclick = () => connectDriveFolder(button.dataset.folder));
$("#useFolderUrl").onclick = () => {
  const url = $("#folderUrl").value.trim();
  if (!url.includes("drive.google.com")) {
    showToast("Paste a valid Google Drive folder link");
    return;
  }
  connectDriveFolder("Shared Drive Folder");
};
$("#closeLockModal").onclick = closePanels;
$("#closeDeleteModal").onclick = closePanels;
$("#cancelDelete").onclick = closePanels;
$("#confirmDelete").onclick = deletePendingFile;
$("#unlockForm").onsubmit = event => {
  event.preventDefault();
  if ($("#libraryPassword").value === "Atlas11") {
    libraryUnlocked = true;
    $("#lockIndicator").textContent = "Open";
    closePanels();
    setView("library");
    showToast("Knowledge Library unlocked");
    return;
  }
  $("#libraryPassword").classList.add("invalid");
  $("#passwordError").classList.add("show");
  $("#libraryPassword").select();
};
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#newThreadBtn").click();
  }
  if (event.key === "Escape") closePanels();
});

renderFiles();
renderConnections();
renderHistory();
