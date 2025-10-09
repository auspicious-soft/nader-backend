import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AdminModel } from "../models/admin-schema.js";
import {
  CREATED,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
} from "../utils/response.js";
import { ENV } from "../config/env.js";

// Code
const router = Router();

router.post("/create-admin", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await AdminModel.create({ email, password: hash });
    return CREATED(res, {});
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

router.get("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const admin = await AdminModel.findOne({ email }).lean();
    if (!admin) {
      return NOT_FOUND(res, "Email not found");
    }
    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return UNAUTHORIZED(res, "Invalid password");
    }

    const token = await jwt.sign(
      { email, password },
      ENV.AUTH_SECRET as string,
      {
        expiresIn: "60d",
      }
    );

    return OK(res, { token });
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

export { router as auth };
