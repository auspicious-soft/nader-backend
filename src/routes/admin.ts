import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  CREATED,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  OK,
  UNAUTHORIZED,
} from "../utils/response.js";
import { ENV } from "../config/env.js";
import { CollectionModel } from "../models/collection-schema.js";
import { SidebarModel } from "../models/sidebar-schema.js";
import { HomepageModel } from "../models/homepage.js";

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
    const decoded = jwt.verify(token, ENV.AUTH_SECRET as string) as any;
    if (!decoded) return UNAUTHORIZED(res);
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
router.get("/dropdown", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let filter = {};
    if (search) {
      filter = { title: { $regex: search, $options: "i" } };
    }
    const response = await CollectionModel.find(filter).select(
      "-id -__v -createdAt -updatedAt"
    );
    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

router.post("/sidebar", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const { title, image, handle, child, parent } = req.body;

    if (parent) {
      const parentSidebar = await SidebarModel.findById(parent);
      if (!parentSidebar) {
        return NOT_FOUND(res, "Parent sidebar not found");
      }
      const newSidebar = (await SidebarModel.create({
        title,
        image,
        handle,
        child,
      })) as any;
      parentSidebar.child.push(newSidebar._id);
      await parentSidebar.save();
      return CREATED(res, newSidebar);
    } else {
      const data = await SidebarModel.create({
        title,
        image,
        handle,
        child,
        isPrime: true,
      });
      return OK(res, data);
    }
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

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

router.patch("/sidebar", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const { id, title, image, handle } = req.body;
    const sidebar = await SidebarModel.findById(id);
    if (!sidebar) {
      return NOT_FOUND(res, "Sidebar not found");
    }
    if (title) sidebar.title = title;
    if (image) sidebar.image = image;
    if (handle) sidebar.handle = handle;
    await sidebar.save();
    return OK(res, sidebar);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

router.delete(
  "/sidebar/:id",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const sidebar = await SidebarModel.findById(id);
      if (!sidebar) {
        return NOT_FOUND(res, "Sidebar not found");
      }

      // Remove this sidebar from any parent's child array
      await SidebarModel.updateMany({ child: id }, { $pull: { child: id } });

      // Finally delete the sidebar itself
      await SidebarModel.findByIdAndDelete(id);

      return OK(res, {}, "Sidebar deleted successfully");
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

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

router.post("/homepage", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const { title, description, image, handle } = req.body;
    const response = {};
    const checkHomeExist = await HomepageModel.findOne();
    if (!checkHomeExist) {
      await HomepageModel.create({
        banners: [],
        styles: [],
      });
    }
    if (type === "banner") {
      const response = await HomepageModel.findOneAndUpdate(
        {},
        {
          $push: {
            banners: { title, description, image, handle },
          },
        },
        { new: true }
      ).select("-id -__v -createdAt -updatedAt");
      return OK(res, response);
    } else if (type === "style") {
      const response = await HomepageModel.findOneAndUpdate(
        {},
        { $push: { styles: { title, image, handle } } },
        { new: true }
      ).select("-id -__v -createdAt -updatedAt");
      return OK(res, response);
    } else if (type === "other") {
      const response = await HomepageModel.findOneAndUpdate(
        {},
        { title, description },
        { new: true }
      ).select("-id -__v -createdAt -updatedAt");
      return OK(res, response);
    } else {
      return NOT_FOUND(res, "Valid type is required");
    }

    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

router.delete(
  "/homepage",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { type, id } = req.query;
      if (!id) return NOT_FOUND(res, "ID is required");
      if (type === "banner") {
        const response = await HomepageModel.findOneAndUpdate(
          {},
          { $pull: { banners: { _id: id } } },
          { new: true }
        ).select("-id -__v -createdAt -updatedAt");
        return OK(res, response);
      } else if (type === "style") {
        const response = await HomepageModel.findOneAndUpdate(
          {},
          { $pull: { styles: { _id: id } } },
          { new: true }
        ).select("-id -__v -createdAt -updatedAt");
        return OK(res, response);
      } else {
        return NOT_FOUND(res, "Valid type is required");
      }
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

export { router as admin };
