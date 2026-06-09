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

const demoDocumentNames = new Set(seedDocuments.map(document => document.name));
seedDocuments.length = 0;

const savedLibrary = loadLibraryState();
let documents = isDeployedSharedApp() ? [...seedDocuments] : (savedLibrary?.documents || [...seedDocuments])
  .filter(document => !demoDocumentNames.has(document.name))
  .map(sanitizeStoredDocument);
let activeSources = [];
let connectedFolders = savedLibrary?.connectedFolders || [];
let latestUploadedDocument = documents.find(doc => doc.isUpload) || null;
let libraryUnlocked = false;
let pendingDeleteIndex = null;
let recentQuestions = loadRecentQuestions();
let sharedLibraryAvailable = false;
let pdfJsModulePromise = null;

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
  documents = documents.map(sanitizeStoredDocument);
  const state = { documents, connectedFolders };
  try {
    localStorage.setItem("atlas-library-state", JSON.stringify(state));
  } catch {
    showToast("Library changes could not be saved in this browser");
  }
  fetch("/api/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  }).then(response => {
    sharedLibraryAvailable = response.ok;
  }).catch(() => {
    sharedLibraryAvailable = false;
  });
}

function isDeployedSharedApp() {
  return location.hostname.includes("onrender.com");
}

async function loadSharedLibraryState() {
  try {
    const response = await fetch("/api/library");
    if (!response.ok) throw new Error("Shared library unavailable");
    const state = await response.json();
    if (!Array.isArray(state.documents) || !Array.isArray(state.connectedFolders)) return;
    documents = state.documents
      .filter(document => !demoDocumentNames.has(document.name))
      .map(sanitizeStoredDocument);
    connectedFolders = state.connectedFolders;
    latestUploadedDocument = documents.find(doc => doc.isUpload) || documents[0] || null;
    sharedLibraryAvailable = true;
    localStorage.setItem("atlas-library-state", JSON.stringify(state));
    renderFiles($("#librarySearch").value);
    renderConnections();
  } catch {
    sharedLibraryAvailable = false;
    documents = documents.map(sanitizeStoredDocument);
    renderFiles($("#librarySearch").value);
    renderConnections();
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

function getQuestionProfile(question) {
  const lower = question.toLowerCase();
  const intents = [
    { type: "summary", pattern: /\b(summary|summarize|summarise|overview|about|say|meaning|main point|breakdown|break down|analyse|analyze|explain)\b/, terms: ["summary", "overview", "purpose", "main", "key", "finding", "conclusion", "recommendation"] },
    { type: "risk", pattern: /\b(risk|issue|problem|challenge|concern|warning|weakness|threat|danger|blocker)\b/, terms: ["risk", "issue", "problem", "challenge", "concern", "warning", "mitigation", "impact"] },
    { type: "action", pattern: /\b(action|next|recommend|should|todo|task|step|improve|fix|plan)\b/, terms: ["action", "next", "recommendation", "step", "owner", "plan", "priority", "improvement"] },
    { type: "financial", pattern: /\b(cost|price|budget|revenue|sales|profit|loss|arr|money|fee|financial)\b/, terms: ["cost", "price", "budget", "revenue", "sales", "profit", "loss", "arr", "fee"] },
    { type: "timeline", pattern: /\b(when|date|deadline|timeline|schedule|milestone|due|month|year|week)\b/, terms: ["date", "deadline", "timeline", "schedule", "milestone", "due", "launch", "start", "end"] },
    { type: "people", pattern: /\b(who|owner|responsible|person|people|team|department|approver|requestor)\b/, terms: ["owner", "responsible", "person", "team", "department", "approver", "requestor"] },
    { type: "metrics", pattern: /\b(number|metric|kpi|percentage|percent|measure|target|result|figure|data)\b/, terms: ["metric", "kpi", "percentage", "percent", "measure", "target", "result", "figure", "data"] },
    { type: "process", pattern: /\b(process|procedure|steps|workflow|how to|guide|requirement|policy|rule)\b/, terms: ["process", "procedure", "step", "workflow", "guide", "requirement", "policy", "rule"] }
  ];
  const matched = intents.filter(intent => intent.pattern.test(lower));
  const profileTerms = new Set(tokenize(question));
  matched.forEach(intent => intent.terms.forEach(term => profileTerms.add(term)));
  return {
    types: matched.map(intent => intent.type),
    terms: [...profileTerms],
    isBroad: matched.some(intent => intent.type === "summary") || tokenize(question).length <= 3
  };
}

function searchDocuments(question) {
  const refersToCurrentDocument = /\b(this|the|uploaded|latest)\s+(report|document|file|spreadsheet|workbook)\b/i.test(question);
  if (refersToCurrentDocument) {
    const document = latestUploadedDocument || documents[0];
    const libraryIndex = documents.findIndex(doc => doc === document || doc.name === document?.name);
    return document ? [{ ...document, libraryIndex, score: 10 }] : [];
  }
  const profile = getQuestionProfile(question);
  const terms = profile.terms;
  return documents.map((doc, libraryIndex) => ({ ...doc, libraryIndex })).filter(doc => isReadableText(doc.content)).map(doc => {
    const words = tokenize(`${doc.name} ${doc.content}`);
    const titleWords = tokenize(doc.name);
    const titleScore = terms.reduce((sum, term) => sum + titleWords.filter(word => word === term).length * 4, 0);
    const contentScore = terms.reduce((sum, term) => sum + words.filter(word => word === term).length, 0);
    const passageScore = splitPassages(doc.content).reduce((best, passage) => Math.max(best, scoreTextAgainstQuestion(passage, profile)), 0);
    const score = titleScore + contentScore + passageScore;
    return { ...doc, score };
  }).filter(doc => doc.score > 0 || profile.isBroad).sort((a, b) => b.score - a.score).slice(0, 5);
}

function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

function splitPassages(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const sentences = splitSentences(cleaned).map(sentence => sentence.trim()).filter(Boolean);
  if (sentences.length <= 2) return sentences;
  const passages = [];
  for (let index = 0; index < sentences.length; index += 2) {
    passages.push(sentences.slice(index, index + 2).join(" "));
  }
  return passages;
}

function scoreTextAgainstQuestion(text, profile) {
  const words = tokenize(text);
  const exactMatches = profile.terms.reduce((sum, term) => sum + words.filter(word => word === term).length, 0);
  const partialMatches = profile.terms.reduce((sum, term) => {
    if (term.length < 5) return sum;
    return sum + words.filter(word => word.includes(term) || term.includes(word)).length * 0.35;
  }, 0);
  const figureBoost = /\d|[$£€%]/.test(text) && profile.types.includes("metrics") ? 3 : 0;
  const dateBoost = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|\d{1,2}:\d{2})\b/i.test(text) && profile.types.includes("timeline") ? 3 : 0;
  return exactMatches + partialMatches + figureBoost + dateBoost;
}

function buildAnswer(question, sources) {
  if (!sources.length) {
    return `<p>I couldn't find a grounded answer in the connected sources. Try using a more specific term, or add a source containing the information you need.</p>`;
  }

  const wantsDownload = /\b(download|save|get|export)\b/i.test(question) && /\b(file|document|report|spreadsheet|workbook|pdf|docx?|xlsx?)\b/i.test(question);
  if (wantsDownload) return buildDownloadAnswer(sources);

  const wantsBreakdown = /\b(breakdown|break down|summari[sz]e|analyse|analyze|simplif|overview)\b/i.test(question)
    || (/\b(what does|what is|explain|about)\b/i.test(question) && /\b(report|document|file|spreadsheet|workbook|this|it)\b/i.test(question));
  if (wantsBreakdown && sources.length) return buildDocumentBreakdown(sources[0]);

  return buildAnalyticalAnswer(question, sources);
}

function buildDownloadAnswer(sources) {
  const links = sources.slice(0, 3).map(source => {
    const index = Number.isInteger(source.libraryIndex) ? source.libraryIndex : documents.findIndex(doc => doc.name === source.name);
    return `<li>${escapeHtml(source.name)} <button class="inline-download" data-index="${index}">Download</button></li>`;
  }).join("");
  return `<p>I found the closest matching document${sources.length > 1 ? "s" : ""}. Choose the one you want to download:</p><ul>${links}</ul>`;
}

function sanitizeStoredDocument(document) {
  const isPdf = document.type === "PDF document" || document.name.toLowerCase().endsWith(".pdf");
  if (isPdf && document.content && !isReadableText(document.content)) {
    return {
      ...document,
      content: `${document.name} needs to be re-uploaded. The previous PDF text extraction saved compressed PDF data instead of readable document text. Upload it again so Atlas can use OCR to scan the full document.`
    };
  }
  return document;
}

function buildAnalyticalAnswer(question, sources) {
  const profile = getQuestionProfile(question);
  const candidates = [];
  sources.forEach((source, sourceIndex) => {
    splitPassages(source.content).forEach(passage => {
      const score = scoreTextAgainstQuestion(passage, profile);
      if (passage.length > 20) candidates.push({ passage, sourceIndex, score });
    });
  });

  candidates.sort((a, b) => b.score - a.score || b.passage.length - a.passage.length);
  let selected = candidates.filter(item => item.score > 0).slice(0, 6);
  if (!selected.length) selected = candidates.slice(0, 5);

  if (!selected.length) {
    return `<p>I can see connected documents, but there is not enough readable text in them to answer this question. If this is a scanned report, upload a clearer PDF so OCR can extract the content.</p>`;
  }

  const strongest = selected[0];
  const sourceName = sources[strongest.sourceIndex]?.name || "the selected source";
  const directAnswer = makeDirectAnswer(question, selected, profile);
  const grouped = selected.reduce((map, item) => {
    const key = item.sourceIndex;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());

  const supportingDetails = [...grouped.entries()].map(([sourceIndex, items]) => {
    const source = sources[sourceIndex];
    const bestItems = items.slice(0, 3).map(item =>
      `<li>${escapeHtml(item.passage)} <button class="citation" data-source="${sourceIndex}">${sourceIndex + 1}</button></li>`
    ).join("");
    return `<h3>${escapeHtml(source.name)}</h3><ul>${bestItems}</ul>`;
  }).join("");

  return `
    <div class="analysis-banner"><span>✦</span><span><strong>Document-aware answer</strong><small>Analyzed ${sources.length} source${sources.length > 1 ? "s" : ""}</small></span></div>
    <h3>Direct answer</h3>
    <p>${directAnswer} <button class="citation" data-source="${strongest.sourceIndex}">${strongest.sourceIndex + 1}</button></p>
    <h3>Why this is the answer</h3>
    ${supportingDetails}
    <div class="simple-version"><h3>Simplified version</h3><p>${escapeHtml(makeSimplifiedAnswer(selected, sourceName))}</p></div>
  `;
}

function makeDirectAnswer(question, selected, profile) {
  const topPassages = selected.slice(0, 3).map(item => item.passage);
  const joined = topPassages.join(" ");
  const first = topPassages[0] || "";
  if (profile.types.includes("risk")) return escapeHtml(`The main risks or concerns appear to be: ${compressText(joined, 360)}`);
  if (profile.types.includes("action")) return escapeHtml(`The most relevant actions or recommendations are: ${compressText(joined, 360)}`);
  if (profile.types.includes("financial")) return escapeHtml(`The financial answer is mainly about these figures or terms: ${compressText(joined, 360)}`);
  if (profile.types.includes("timeline")) return escapeHtml(`The relevant timeline or date information is: ${compressText(joined, 360)}`);
  if (profile.types.includes("people")) return escapeHtml(`The people, teams, or owners mentioned are: ${compressText(joined, 360)}`);
  if (profile.types.includes("metrics")) return escapeHtml(`The relevant metrics or data points are: ${compressText(joined, 360)}`);
  if (profile.types.includes("process")) return escapeHtml(`The relevant process or requirement is: ${compressText(joined, 360)}`);
  return escapeHtml(compressText(first || joined, 420));
}

function makeSimplifiedAnswer(selected, sourceName) {
  const plain = selected.slice(0, 3).map(item => item.passage).join(" ");
  return `In simple terms, ${sourceName} says: ${compressText(plain, 300)}`;
}

function compressText(text, maxLength) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength);
  return `${sliced.slice(0, sliced.lastIndexOf(" ") || maxLength)}...`;
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
  $$(".inline-download").forEach(button => button.onclick = () => downloadDocument(Number(button.dataset.index)));
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
      <p>${escapeHtml(isReadableText(source.content) ? source.content : `${source.name} needs to be re-uploaded so OCR can extract readable text.`)}</p>
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
      <span>${doc.type}</span><span>${doc.synced}</span><span class="file-actions"><button class="download-file" data-index="${documents.indexOf(doc)}" title="Download ${escapeHtml(doc.name)}" aria-label="Download ${escapeHtml(doc.name)}">↓</button><button class="delete-file" data-index="${documents.indexOf(doc)}" title="Delete ${escapeHtml(doc.name)}" aria-label="Delete ${escapeHtml(doc.name)}">×</button></span>
    </div>`).join("");
  $$(".download-file").forEach(button => button.onclick = () => downloadDocument(Number(button.dataset.index)));
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

function downloadDocument(index) {
  const libraryDocument = documents[index];
  if (!libraryDocument) return;

  if (libraryDocument.fileData) {
    triggerDownload(libraryDocument.fileData, libraryDocument.name);
    return;
  }

  if (sharedLibraryAvailable || isDeployedSharedApp()) {
    triggerDownload(`/api/library/download/${index}`, textExportName(libraryDocument.name));
    return;
  }

  const blob = new Blob([libraryDocument.content || ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, textExportName(libraryDocument.name));
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast(`Downloading ${filename}`);
}

function textExportName(filename) {
  return filename.toLowerCase().endsWith(".txt") ? filename : `${filename}.txt`;
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
      mimeType: file.type,
      fileData: await readFileAsDataUrl(file),
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function extractDocumentText(file, extension) {
  try {
    const buffer = await file.arrayBuffer();
    if (extension === "docx") return extractDocxText(buffer);
    if (extension === "xlsx") return extractXlsxText(buffer);
    if (extension === "pdf") return extractPdfTextWithOcr(buffer, file.name);
    const text = extractReadableStrings(buffer);
    return isReadableText(text) ? text : "";
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
  const text = pieces.join(" ").replace(/\s+/g, " ").trim();
  return isReadableText(text) ? text : "";
}

async function extractPdfTextWithOcr(buffer, fileName) {
  const pdfText = await extractPdfTextWithPdfJs(buffer);
  if (pdfText.length > 180) return pdfText;

  const directText = extractPdfText(buffer);
  if (directText.length > 180) return directText;

  const ocrText = await ocrPdfPages(buffer, fileName);
  return isReadableText(ocrText) ? ocrText : "";
}

async function extractPdfTextWithPdfJs(buffer) {
  const pdfjsLib = await loadPdfJs();
  if (!pdfjsLib) return "";
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
      if (text) pages.push(`Page ${pageNumber}: ${text}`);
    }
    const joined = pages.join(". ");
    return isReadableText(joined) ? joined : "";
  } catch (error) {
    console.warn("PDF text extraction failed", error);
    return "";
  }
}

async function ocrPdfPages(buffer, fileName) {
  const pdfjsLib = await loadPdfJs();
  if (!pdfjsLib || !window.Tesseract) {
    showToast("OCR tools are loading. Try uploading again in a moment.");
    return "";
  }

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pageLimit = pdf.numPages;
    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber++) {
      showToast(`OCR reading ${fileName} · page ${pageNumber}/${pageLimit}`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;

      const result = await window.Tesseract.recognize(canvas, "eng", {
        logger: event => {
          if (event.status === "recognizing text") {
            const percent = Math.round((event.progress || 0) * 100);
            if (percent && percent % 25 === 0) showToast(`OCR page ${pageNumber}: ${percent}%`);
          }
        }
      });
      const text = result?.data?.text?.replace(/\s+/g, " ").trim();
      if (text) pageTexts.push(`Page ${pageNumber}: ${text}`);
    }

    return pageTexts.join(". ");
  } catch (error) {
    console.warn("OCR failed", error);
    showToast("OCR could not read this PDF");
    return "";
  }
}

async function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs")
      .catch(error => {
        console.warn("PDF.js failed to load", error);
        return null;
      });
  }
  return pdfJsModulePromise;
}

function extractReadableStrings(buffer) {
  return new TextDecoder("latin1").decode(buffer).match(/[A-Za-z][A-Za-z0-9 ,.;:$%()'"/-]{20,}/g)?.join(" ") || "";
}

function isReadableText(text) {
  if (!text || text.trim().length < 20) return false;
  const cleaned = text.replace(/\s+/g, " ").trim();
  const printable = (cleaned.match(/[A-Za-z0-9 .,;:!?'"()/$%&+\-\n]/g) || []).length;
  const letters = (cleaned.match(/[A-Za-z]/g) || []).length;
  const suspicious = (cleaned.match(/[^\x09\x0A\x0D\x20-\x7E£€–—‘’“”]/g) || []).length;
  const controls = (cleaned.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  return printable / cleaned.length > 0.82 && letters / cleaned.length > 0.18 && (suspicious + controls) / cleaned.length < 0.04;
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
loadSharedLibraryState();
