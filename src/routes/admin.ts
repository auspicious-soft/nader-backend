import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  BADREQUEST,
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
import { deleteFileFromS3, multerUpload, uploadFileToS3 } from "../utils/s3.js";
import sharp from "sharp";

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
      if (sidebar?.image) await deleteFileFromS3(sidebar?.image);
      sidebar.image = image;
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

      if (sidebar?.image) await deleteFileFromS3(sidebar?.image);

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
    const { title, description, image, handle, fabricName } = req.body;
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
    } else if (type === "fabric") {
      const response = await HomepageModel.findOneAndUpdate(
        {},
        { $push: { fabrics: { title, image, handle, fabricName } } },
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
        const deletedImage = (await HomepageModel.findOne(
          { "banners._id": id },
          { "banners.$": 1 }
        ).lean()) as any;

        if (deletedImage?.banners[0]?.image)
          await deleteFileFromS3(deletedImage?.banners[0]?.image);
        else return NOT_FOUND(res, "Banner image not found");

        const response = (await HomepageModel.findOneAndUpdate(
          {},
          { $pull: { banners: { _id: id } } },
          { new: true }
        ).select("-id -__v -createdAt -updatedAt")) as any;

        return OK(res, response);
      } else if (type === "style") {
        const deletedImage = (await HomepageModel.findOne(
          { "styles._id": id },
          { "styles.$": 1 }
        ).lean()) as any;

        if (deletedImage?.styles[0]?.image)
          await deleteFileFromS3(deletedImage?.styles[0]?.image);
        else return NOT_FOUND(res, "Style image not found");

        const response = await HomepageModel.findOneAndUpdate(
          {},
          { $pull: { styles: { _id: id } } },
          { new: true }
        ).select("-id -__v -createdAt -updatedAt");

        return OK(res, response);
      } else if (type === "fabric") {
        const deletedImage = (await HomepageModel.findOne(
          { "fabrics._id": id },
          { "fabrics.$": 1 }
        ).lean()) as any;

        if (deletedImage?.fabrics[0]?.image)
          await deleteFileFromS3(deletedImage?.fabrics[0]?.image);
        else return NOT_FOUND(res, "Fabric image not found");

        const response = await HomepageModel.findOneAndUpdate(
          {},
          { $pull: { fabrics: { _id: id } } },
          { new: true }
        ).select("-id -__v -createdAt -updatedAt");

        return OK(res, response);
      }else {
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
      const { title, pointers, image, id, description, shortDescription } =
        req.body;

      if (id) {
        const styleGuid = await StyleGuidModel.findById(id);
        if (!styleGuid) {
          return NOT_FOUND(res, "Style guide not found");
        }
        styleGuid.title = title || styleGuid.title;
        styleGuid.pointers = pointers || styleGuid.pointers;
        styleGuid.image = image || styleGuid.image;
        styleGuid.description = description || styleGuid.description;
        styleGuid.shortDescription =
          shortDescription || styleGuid.shortDescription;
        await styleGuid.save();
        return OK(res, styleGuid);
      } else {
        const data = await StyleGuidModel.create({
          title,
          pointers,
          image,
          description,
          shortDescription,
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

        // if (image && styleGuid?.youtube?.image !== image) {
        // 	await deleteFileFromS3(styleGuid?.youtube?.image || "");
        // }
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

        // if (image && styleGuid?.lengths?.[0]?.image !== image) {
        // 	await deleteFileFromS3(styleGuid?.lengths?.[0]?.image || "");
        // }

        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "paring") {
        styleGuid.paring.push({
          image,
          title,
          handle: handle || null,
        });

        // if (image && styleGuid?.paring?.[0]?.image !== image) {
        // 	await deleteFileFromS3(styleGuid?.paring?.[0]?.image || "");
        // }
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "feature") {
        console.log("image: ", image);
        styleGuid.featureImgURL = image;
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
      const styleGuid = (await StyleGuidModel.findById(sid)) as any;
      if (!styleGuid) {
        return NOT_FOUND(res, "Style guide not found");
      }
      if (type === "length") {
        if (!id) return NOT_FOUND(res, "ID is required");
        const image = styleGuid?.lengths.find(
          (data: any) => data._id.toString() == id
        ) as any;
        console.log(image.image);
        await deleteFileFromS3(image.image);
        styleGuid.lengths = styleGuid.lengths.filter(
          (length: any) => length._id?.toString() !== id
        );
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "paring") {
        if (!id) return NOT_FOUND(res, "ID is required");
        const image = styleGuid?.paring.find(
          (data: any) => data._id.toString() == id
        ) as any;
        await deleteFileFromS3(image.image);
        styleGuid.paring = styleGuid.paring.filter(
          (paring: any) => paring._id?.toString() !== id
        );
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "youtube") {
        await deleteFileFromS3(styleGuid?.youtube?.image);
        styleGuid.youtube = { image: null, link: null };
        await styleGuid.save();
        return OK(res, styleGuid);
      } else if (type === "feature") {
        await deleteFileFromS3(styleGuid.featureImgURL);
        styleGuid.featureImgURL = null;
        await styleGuid.save();
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

// Upload to S3 route

router.post(
  "/upload",
  checkUserAuth,
  multerUpload,
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return BADREQUEST(res, "Missing file or user");
      }

      let fileBuffer = file.buffer;

      // ✅ If it's an image, compress it with sharp
      if (file.mimetype.startsWith("image/")) {
        fileBuffer = await sharp(file.buffer)
          .resize({ width: 1280 }) // optional: resize max width
          .jpeg({ quality: 50 }) // compress JPEG to ~50% quality
          .toBuffer();
      }

      const result = await uploadFileToS3(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      return CREATED(res, result);
    } catch (err: any) {
      console.error("S3 Upload Error:", err);
      if (err.message) {
        return BADREQUEST(res, err.message);
      }
      return INTERNAL_SERVER_ERROR(res, err);
    }
  }
);

export { router as admin };
