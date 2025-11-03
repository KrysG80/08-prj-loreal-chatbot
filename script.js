// loreal.js
// --- Configuration ---
// For Cloudflare Worker mode, put your Worker URL below, e.g. https://your-subdomain.workers.dev
const WORKER_URL = ""; // leave blank to use direct API with secrets.js (local dev)

// System prompt: strictly on-topic responses for L’Oréal products and beauty advice
const SYSTEM_PROMPT = `You are L’Oréal Beauty Assistant, a helpful, concise expert on L’Oréal products (skincare, makeup, haircare, fragrance) and beauty routines.
- Only answer questions related to L’Oréal, beauty routines, product recommendations, ingredients, application tips, suitability by skin/hair type, and shopping or shade guidance.
- If a question is unrelated (e.g., homework, politics, unrelated tech, other brands), politely refuse and steer the user back to L’Oréal/beauty topics.
- Ask brief follow-up questions when needed for personalization (skin type, hair concerns, sensitivities, budget).
- Keep responses scannable with short paragraphs or bullet points when helpful.
- Never claim to be a medical professional; for medical concerns, suggest seeing a dermatologist.
- Keep brand tone: refined, friendly, empowering.`;

// --- Elements ---
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const lastQuestionEl = document.getElementById("lastQuestion");

// --- Conversation state (persist for LevelUp) ---
const STATE_KEY = "loreal_chat_history_v1";
let messages = loadHistory();

// Initialize with system + greeting if empty
if (messages.length === 0) {
  messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "assistant", content: "Bonjour! I’m your L’Oréal Beauty Assistant. Ask me about products or routines and I’ll tailor recommendations." }
  ];
  saveHistory();
}
renderAll();

// --- Helpers ---
function saveHistory() {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(messages));
  } catch (e) {}
}

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function bubble(content, who = "ai") {
  const div = document.createElement("div");
  div.className = `bubble ${who}`;
  div.innerText = content;
  return div;
}

function showTyping() {
  const wrap = document.createElement("div");
  wrap.className = "typing";
  wrap.dataset.typing = "true";
  wrap.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  chatWindow.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function removeTyping() {
  const node = chatWindow.querySelector('[data-typing="true"]');
  if (node) node.remove();
}

function renderAll() {
  chatWindow.innerHTML = "";
  for (const m of messages) {
    if (m.role === "assistant" && m.content === SYSTEM_PROMPT) continue;
    if (m.role === "system") continue;
    chatWindow.appendChild(bubble(m.content, m.role === "user" ? "user" : "ai"));
  }
  scrollToBottom();
}

// --- Submit handler ---
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Push user message
  messages.push({ role: "user", content: text });
  saveHistory();

  // Update UI
  chatWindow.appendChild(bubble(text, "user"));
  lastQuestionEl.style.display = "block";
  lastQuestionEl.textContent = "You asked: " + text;
  userInput.value = "";
  const typing = showTyping();

  try {
    const reply = await getAIResponse(messages);
    removeTyping();

    // Add assistant message
    messages.push({ role: "assistant", content: reply });
    saveHistory();
    chatWindow.appendChild(bubble(reply, "ai"));
    scrollToBottom();
  } catch (err) {
    removeTyping();
    const errorMsg = "Sorry—there was a problem reaching the AI. Please try again.";
    messages.push({ role: "assistant", content: errorMsg });
    chatWindow.appendChild(bubble(errorMsg, "ai"));
    scrollToBottom();
  }
});

// --- Network ---
async function getAIResponse(msgs) {
  // Ensure system prompt is the first message (in case history was wiped)
  if (!msgs.length || msgs[0].role !== "system") {
    msgs.unshift({ role: "system", content: SYSTEM_PROMPT });
  }

  if (WORKER_URL) {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs })
    });
    if (!res.ok) throw new Error("Worker HTTP " + res.status);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from worker");
    return content;
  }

  // Local dev fallback: call OpenAI directly with secrets.js
  const apiKey = window.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No API key found. Set WORKER_URL or include secrets.js.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: msgs,
      max_tokens: 600
    })
  });
  if (!res.ok) throw new Error("OpenAI HTTP " + res.status);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content from OpenAI");
  return content;
}

// Optional: expose a small API for clearing history
window.clearLorealHistory = function () {
  sessionStorage.removeItem(STATE_KEY);
  messages = [{ role: "system", content: SYSTEM_PROMPT }];
  saveHistory();
  renderAll();
};
