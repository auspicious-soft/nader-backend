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
import { StyleGuidModel } from "../models/style-guid.js";
import { HomeHeadModel } from "../models/home-head.js";

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
    if (title) {
      sidebar.title = title;
    }
    if (image && image !== sidebar.image) {
      sidebar.image = image;
      //TODO : Have to delete old image from S3
    }
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

      //TODO : Have to delete old image from S3

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
        //TODO : Have to delete old image from S3
        return OK(res, response);
      } else if (type === "style") {
        const response = await HomepageModel.findOneAndUpdate(
          {},
          { $pull: { styles: { _id: id } } },
          { new: true }
        ).select("-id -__v -createdAt -updatedAt");
        //TODO : Have to delete old image from S3
        return OK(res, response);
      } else {
        return NOT_FOUND(res, "Valid type is required");
      }
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

// Home-head routes

router.post(
  "/homepage-head",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title || !description)
        return NOT_FOUND(res, "Title and Description are required");
      const checkHomeHeadExist = await HomeHeadModel.findOne();

      if (checkHomeHeadExist) {
        checkHomeHeadExist.title = title || checkHomeHeadExist.title;
        checkHomeHeadExist.description =
          description || checkHomeHeadExist.description;
        await checkHomeHeadExist.save();
        return OK(res, checkHomeHeadExist);
      } else {
        const data = await HomeHeadModel.create({
          title,
          description,
        });
        return CREATED(res, data);
      }
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

router.get(
  "/homepage-head",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const response = await HomeHeadModel.findOne()
        .select("-id -__v -createdAt -updatedAt")
        .lean();
      return OK(res, response);
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

router.delete(
  "/homepage-head",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const response = await HomeHeadModel.findOneAndDelete();
      if (!response) return NOT_FOUND(res, "Homepage head not found");
      return OK(res, response);
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

// Style-guid routes
router.post(
  "/styleguid",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { title, pointers, image, id } = req.body;

      if (id) {
        const styleGuid = await StyleGuidModel.findById(id);
        if (!styleGuid) {
          return NOT_FOUND(res, "Style guide not found");
        }
        styleGuid.title = title || styleGuid.title;
        styleGuid.pointers = pointers || styleGuid.pointers;
        styleGuid.image = image || styleGuid.image;
        await styleGuid.save();
        return OK(res, styleGuid);
      } else {
        const data = await StyleGuidModel.create({
          title,
          pointers,
          image,
        });

        return CREATED(res, data);
      }
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

router.post(
  "/styleguid-subsection",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { type } = req.query;
      const { title, pointers, description, handle, link, image, id } =
        req.body;

      if (!id) return NOT_FOUND(res, "Style guide ID is required");
      const styleGuid = await StyleGuidModel.findById(id);

      if (!styleGuid) {
        return NOT_FOUND(res, "Style guide not found");
      }

      if (!type) return NOT_FOUND(res, "Type is required");

      if (type === "youtube") {
        styleGuid.youtube = {
          image: image || null,
          link: link || null,
        };
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "length") {
        styleGuid.lengths.push({
          image,
          title,
          description,
          pointers: pointers || [],
          handle: handle || null,
        });
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "paring") {
        styleGuid.paring.push({
          image,
          title,
          handle: handle || null,
        });
        await styleGuid.save();
        return OK(res, styleGuid);
      } else {
        return NOT_FOUND(res, "Valid type is required");
      }
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

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

router.delete(
  "/styleguid",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { type, sid, id } = req.query;
      if (!sid) return NOT_FOUND(res, "Style guide ID is required");
      const styleGuid = await StyleGuidModel.findById(sid);
      if (!styleGuid) {
        return NOT_FOUND(res, "Style guide not found");
      }
      if (type === "length") {
        if (!id) return NOT_FOUND(res, "ID is required");

        styleGuid.lengths = styleGuid.lengths.filter(
          (length: any) => length._id?.toString() !== id
        );
        //TODO : Have to delete old image from S3
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "paring") {
        if (!id) return NOT_FOUND(res, "ID is required");

        styleGuid.paring = styleGuid.paring.filter(
          (paring: any) => paring._id?.toString() !== id
        );
        //TODO : Have to delete old image from S3
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "youtube") {
        styleGuid.youtube = { image: null, link: null };
        await styleGuid.save();
        //TODO : Have to delete old image from S3
        return OK(res, styleGuid);
      } else if (type === "styleguid") {
        await StyleGuidModel.findByIdAndDelete(sid);
        //TODO : Have to delete old image from S3
        return OK(res, {}, "Style guide deleted successfully");
      } else {
        return NOT_FOUND(res, "Valid type is required");
      }
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

export { router as admin };
