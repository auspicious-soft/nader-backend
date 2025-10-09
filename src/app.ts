import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ENV } from "./config/env.js";
import connectDB from "./config/db.js";
import { auth } from "./routes/auth.js";
import { admin } from "./routes/admin.js";
import { user } from "./routes/user.js";

// Load environment variables
dotenv.config();

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = ENV.PORT || 8000;
const app = express();

// Middleware
app.set("trust proxy", 1); // trust first proxy (good for production with load balancers)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // better to control via env
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    credentials: true,
  })
);

// Static files
const staticDir = path.join(__dirname, "static");
app.use(express.static(staticDir));

const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// Connect to db
connectDB();

// Health check / root route
app.get("/", (_: Request, res: Response) => {
  res.status(200).send("Hello world entry point 🚀✅");
});

app.use("/api", auth);
app.use("/api/admin", admin);
app.use("/api/user", user);

// 404 handler
app.use((_: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Global error handler
app.use((err: unknown, _: Request, res: Response, __: express.NextFunction) => {
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
app.listen(PORT, () =>
  console.log(`✅ Server is running at http://localhost:${PORT}`)
);
