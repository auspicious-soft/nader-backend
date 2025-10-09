import { Router, Request, Response, NextFunction } from "express";
import { INTERNAL_SERVER_ERROR, OK, UNAUTHORIZED } from "../utils/response.js";
import { SidebarModel } from "../models/sidebar-schema.js";
import { HomepageModel } from "../models/homepage.js";
import { StyleGuidModel } from "../models/style-guid.js";
import { ENV } from "../config/env.js";

// Code
const router = Router();

const checkUserAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return UNAUTHORIZED(res);
    }
    const decoded = token === ENV.MOBILE_APP_API_SECRET;
    if (decoded) {
      next();
    } else {
      return INTERNAL_SERVER_ERROR(res, "Something went wrong");
    }
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
};

// Sidebar routes
router.get("/sidebar", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const response = await SidebarModel.find({ isPrime: true })
      .populate({
        path: "child",
        select: "-__v -createdAt -updatedAt",
        populate: {
          path: "child",
          select: "-__v -createdAt -updatedAt",
          populate: {
            path: "child",
            select: "-__v -createdAt -updatedAt",
          },
        },
      })
      .select("-__v -createdAt -updatedAt")
      .lean();

    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

// Homepage routes
router.get("/homepage", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const response = await HomepageModel.findOne()
      .select("-id -__v -createdAt -updatedAt")
      .lean();
    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

// Style-guid routes
router.get("/styleguid", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const response = await StyleGuidModel.find()
      .select("-id -__v -createdAt -updatedAt")
      .lean();
    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

export { router as user };
