require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "development-only-change-me";
const USE_DB = Boolean(process.env.MONGO_URI);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["donor", "recipient", "admin"], default: "donor" },
  organization: { type: String, default: "" },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

const foodSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, default: "Prepared meals" },
  quantity: { type: String, required: true },
  description: { type: String, default: "" },
  location: { type: String, required: true },
  pickupBy: { type: Date, required: true },
  donorId: { type: String, required: true },
  donorName: { type: String, required: true },
  status: { type: String, enum: ["available", "claimed", "completed"], default: "available" },
  claimedBy: { type: String, default: "" },
  claimedByName: { type: String, default: "" },
  image: { type: String, default: "" }
}, { timestamps: true });

let User, Food;
if (USE_DB) {
  User = mongoose.model("User", userSchema);
  Food = mongoose.model("Food", foodSchema);
}

// Lightweight in-memory mode makes the starter project runnable without MongoDB.
// Data resets when the server stops. Configure MONGO_URI for persistence.
const memory = { users: [], foods: [] };
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const asPublicUser = u => ({
  id: String(u._id || u.id), name: u.name, email: u.email, role: u.role,
  organization: u.organization || "", verified: Boolean(u.verified)
});

async function findUserByEmail(email) {
  return USE_DB ? User.findOne({ email: String(email).toLowerCase() }) :
    memory.users.find(u => u.email === String(email).toLowerCase()) || null;
}
async function findUserById(userId) {
  return USE_DB ? User.findById(userId) : memory.users.find(u => u.id === userId) || null;
}
async function allUsers() { return USE_DB ? User.find().sort({ createdAt: -1 }) : [...memory.users].reverse(); }
async function allFoods() { return USE_DB ? Food.find().sort({ createdAt: -1 }) : [...memory.foods].reverse(); }
async function getFood(foodId) { return USE_DB ? Food.findById(foodId) : memory.foods.find(f => f.id === foodId) || null; }
async function saveFood(data) {
  if (USE_DB) return (await new Food(data).save());
  const item = { id: id(), ...data, createdAt: new Date().toISOString() };
  memory.foods.push(item); return item;
}
async function updateFood(food, patch) {
  if (USE_DB) { Object.assign(food, patch); return food.save(); }
  Object.assign(food, patch); return food;
}
async function createUser(data) {
  if (USE_DB) return new User(data).save();
  const user = { id: id(), ...data, createdAt: new Date().toISOString() };
  memory.users.push(user); return user;
}
async function updateUser(user, patch) {
  if (USE_DB) { Object.assign(user, patch); return user.save(); }
  Object.assign(user, patch); return user;
}
async function deleteFood(food) {
  if (USE_DB) return Food.deleteOne({ _id: food._id });
  memory.foods = memory.foods.filter(f => f.id !== food.id);
}
async function seedDemo() {
  if (await findUserByEmail("donor@foodshare.demo")) return;
  const pass = await bcrypt.hash("FoodShare123!", 10);
  const demoUsers = [
    { name: "Green Table Kitchen", email: "donor@foodshare.demo", passwordHash: pass, role: "donor", organization: "Green Table Kitchen", verified: true },
    { name: "Hope Community Centre", email: "recipient@foodshare.demo", passwordHash: pass, role: "recipient", organization: "Hope Community Centre", verified: true },
    { name: "FoodShare Admin", email: "admin@foodshare.demo", passwordHash: pass, role: "admin", organization: "FoodShare", verified: true }
  ];
  for (const u of demoUsers) await createUser(u);
  const donor = await findUserByEmail("donor@foodshare.demo");
  const now = Date.now();
  const samples = [
    { title: "Fresh vegetable meal boxes", category: "Prepared meals", quantity: "18 meal boxes", description: "Freshly prepared vegetarian meals, packed and ready for pickup.", location: "Fort Kochi Community Kitchen", pickupBy: new Date(now + 6 * 3600000), donorId: String(donor._id || donor.id), donorName: donor.name, status: "available", claimedBy: "", claimedByName: "", image: "🥗" },
    { title: "Bakery bread & rolls", category: "Bakery", quantity: "30 pieces", description: "A mix of bread rolls and loaves from today's morning batch.", location: "Market Road, Ernakulam", pickupBy: new Date(now + 4 * 3600000), donorId: String(donor._id || donor.id), donorName: donor.name, status: "available", claimedBy: "", claimedByName: "", image: "🥖" },
    { title: "Seasonal fruit basket", category: "Produce", quantity: "12 kg", description: "Bananas, apples and oranges. Please bring reusable crates.", location: "Panampilly Nagar, Kochi", pickupBy: new Date(now + 9 * 3600000), donorId: String(donor._id || donor.id), donorName: donor.name, status: "available", claimedBy: "", claimedByName: "", image: "🍎" }
  ];
  for (const f of samples) await saveFood(f);
}

function auth(required = true) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return required ? res.status(401).json({ error: "Please log in to continue." }) : next();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await findUserById(payload.sub);
      if (!user) return res.status(401).json({ error: "Session not found. Please log in again." });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }
  };
}
function allow(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next() : res.status(403).json({ error: "You don't have permission to do that." });
}
function foodView(f) {
  return {
    id: String(f._id || f.id), title: f.title, category: f.category, quantity: f.quantity,
    description: f.description, location: f.location, pickupBy: f.pickupBy,
    donorId: f.donorId, donorName: f.donorName, status: f.status,
    claimedBy: f.claimedBy || "", claimedByName: f.claimedByName || "", image: f.image || "🍱",
    createdAt: f.createdAt
  };
}

app.get("/api/health", (req, res) => res.json({ status: "ok", database: USE_DB ? "mongodb-configured" : "demo-memory-mode" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, organization } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required." });
    if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!["donor", "recipient"].includes(role || "donor")) return res.status(400).json({ error: "Choose donor or recipient account." });
    if (await findUserByEmail(email)) return res.status(409).json({ error: "An account with this email already exists." });
    const user = await createUser({
      name: String(name).trim(), email: String(email).trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10), role: role || "donor",
      organization: String(organization || "").trim(), verified: false
    });
    const token = jwt.sign({ sub: String(user._id || user.id) }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: asPublicUser(user) });
  } catch (e) { res.status(500).json({ error: "Could not create account." }); }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await findUserByEmail(email || "");
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash)))
    return res.status(401).json({ error: "Email or password is incorrect." });
  const token = jwt.sign({ sub: String(user._id || user.id) }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: asPublicUser(user) });
});

app.get("/api/auth/me", auth(), (req, res) => res.json({ user: asPublicUser(req.user) }));

app.get("/api/foods", async (req, res) => {
  const { search = "", category = "all", status = "available" } = req.query;
  let foods = (await allFoods()).map(foodView);
  if (status !== "all") foods = foods.filter(f => f.status === status);
  if (category !== "all") foods = foods.filter(f => f.category === category);
  const q = String(search).toLowerCase().trim();
  if (q) foods = foods.filter(f => [f.title, f.description, f.location, f.category, f.donorName].some(v => String(v).toLowerCase().includes(q)));
  res.json({ foods });
});

app.post("/api/foods", auth(), allow("donor", "admin"), async (req, res) => {
  const { title, category, quantity, description, location, pickupBy, image } = req.body || {};
  if (!title || !quantity || !location || !pickupBy) return res.status(400).json({ error: "Title, quantity, pickup location and pickup deadline are required." });
  if (new Date(pickupBy).getTime() <= Date.now()) return res.status(400).json({ error: "Pickup deadline must be in the future." });
  const food = await saveFood({
    title: String(title).trim(), category: category || "Prepared meals", quantity: String(quantity).trim(),
    description: String(description || "").trim(), location: String(location).trim(), pickupBy: new Date(pickupBy),
    donorId: String(req.user._id || req.user.id), donorName: req.user.organization || req.user.name,
    status: "available", claimedBy: "", claimedByName: "", image: image || "🍱"
  });
  res.status(201).json({ food: foodView(food) });
});

app.post("/api/foods/:id/claim", auth(), allow("recipient"), async (req, res) => {
  const food = await getFood(req.params.id);
  if (!food) return res.status(404).json({ error: "Food listing not found." });
  if (food.status !== "available") return res.status(409).json({ error: "This donation has already been claimed." });
  const updated = await updateFood(food, {
    status: "claimed", claimedBy: String(req.user._id || req.user.id),
    claimedByName: req.user.organization || req.user.name
  });
  res.json({ food: foodView(updated), message: "Donation claimed. Please coordinate pickup with the donor." });
});

app.post("/api/foods/:id/complete", auth(), async (req, res) => {
  const food = await getFood(req.params.id);
  if (!food) return res.status(404).json({ error: "Food listing not found." });
  const uid = String(req.user._id || req.user.id);
  if (req.user.role !== "admin" && food.donorId !== uid && food.claimedBy !== uid)
    return res.status(403).json({ error: "Only the donor, recipient or admin can complete this donation." });
  const updated = await updateFood(food, { status: "completed" });
  res.json({ food: foodView(updated) });
});

app.delete("/api/foods/:id", auth(), async (req, res) => {
  const food = await getFood(req.params.id);
  if (!food) return res.status(404).json({ error: "Food listing not found." });
  const uid = String(req.user._id || req.user.id);
  if (req.user.role !== "admin" && food.donorId !== uid)
    return res.status(403).json({ error: "Only the donor who created this listing or an admin can remove it." });
  await deleteFood(food);
  res.json({ message: "Food listing removed." });
});

app.get("/api/dashboard", auth(), async (req, res) => {
  const foods = (await allFoods()).map(foodView);
  const users = await allUsers();
  const mine = foods.filter(f => f.donorId === String(req.user._id || req.user.id) || f.claimedBy === String(req.user._id || req.user.id));
  res.json({
    stats: {
      available: foods.filter(f => f.status === "available").length,
      claimed: foods.filter(f => f.status === "claimed").length,
      completed: foods.filter(f => f.status === "completed").length,
      users: users.length, mealsShared: foods.filter(f => f.status === "completed").length * 4
    },
    myFoods: mine,
    recentFoods: foods.slice(0, 6),
    users: req.user.role === "admin" ? users.map(asPublicUser) : []
  });
});

app.get("/api/admin/users", auth(), allow("admin"), async (req, res) => {
  res.json({ users: (await allUsers()).map(asPublicUser) });
});
app.patch("/api/admin/users/:id/verify", auth(), allow("admin"), async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const updated = await updateUser(user, { verified: !user.verified });
  res.json({ user: asPublicUser(updated) });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function start() {
  if (USE_DB) {
    try { await mongoose.connect(process.env.MONGO_URI); console.log("MongoDB connected"); }
    catch (e) { console.error("MongoDB connection failed:", e.message); process.exit(1); }
  } else {
    console.log("Running in demo-memory mode. Set MONGO_URI in .env for persistent storage.");
  }
  await seedDemo();
  if (!process.env.JWT_SECRET) console.warn("Set JWT_SECRET in .env before deployment.");
  app.listen(PORT, () => console.log(`FoodShare running at http://localhost:${PORT}`));
}
start();
