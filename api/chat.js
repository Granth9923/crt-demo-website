// Vercel serverless function: keeps your Anthropic API key on the server.
const TOPICS = ["DSA","DBMS","OS","Maths","Statistics","Python","Machine Learning","Digital Electronics","Signals and Systems","Communication Systems","Microprocessors","Thermodynamics","Fluid Mechanics","Strength of Materials","Machine Design","Structural Analysis","Surveying","Concrete Technology","Geotechnical Engineering","Critical Thinking"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const raw = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }));
    while (raw.length && raw[0].role !== "user") raw.shift();
    const messages = [];
    for (const m of raw) {
      const last = messages[messages.length - 1];
      if (last && last.role === m.role) last.content += "\n" + m.content;
      else messages.push(m);
    }
    if (!messages.length || messages[messages.length - 1].role !== "user")
      return res.status(400).json({ error: "Last message must be from the user" });

    const weak = (Array.isArray(body.weak) ? body.weak : []).filter(t => TOPICS.includes(t)).slice(0, 2);
    const branch = ["CSE", "AIML", "ENTC", "Mechanical", "Civil"].includes(body.branch) ? body.branch : "engineering";
    const system =
      `You are LearnWise, a study assistant for college ${branch} students. ` +
      `Answer conceptual and simple topic questions directly with a short, clear explanation (3 to 5 sentences) and one simple example. ` +
      `For graded assignments, exams or lab submissions, give hints and steps instead of the final answer. ` +
      `Encourage critical thinking and group study, and keep replies under 150 words.` +
      (weak.length ? ` The student's weakest topics are ${weak.join(" and ")}.` : "");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-haiku-5-5", max_tokens: 500, system, messages }),
    });
    if (!r.ok) { console.error(await r.text()); return res.status(502).json({ error: "Upstream error" }); }
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};
