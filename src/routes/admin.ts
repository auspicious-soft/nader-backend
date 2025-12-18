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
import { sendNotification } from "../utils/FCM.js";
import { SidebarModel1 } from "../models/sidebar1-schema.js";
import { error } from "console";
import { SidebarModel2 } from "../models/sidebar2-schema.js";
import { SidebarModel3 } from "../models/sidebar3-schema.js";
import axios from "axios";
import { notificatonModel } from "../models/notification-schema.js";
import { PromoCodeModel } from "../models/promocodes-schema.js";
import { SyncJobModel } from "../models/sync-job-schema.js";
import { syncPromoCodes } from "../utils/cron.js";
import { fcmTokenModel } from "../models/fcmToken.js";

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

router.post(
  "/notifications",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const checkFCM = await fcmTokenModel.find();
      if (checkFCM.length === 0) {
        return BADREQUEST(res, "No users available for notifications");
      }
      const { title, description, handle, handleTitle } = req.body;
      await sendNotification({
        adminTitle: title,
        adminDescription: description,
        handle: handle || "",
        handleTitle: handleTitle || "",
      });
      return OK(res, {}, "Notifications sent successfully");
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

router.get(
  "/notifications",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 25 } = req.query;

      const notifications = await notificatonModel
        .find()
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      const totalCount = await notificatonModel.countDocuments();

      return OK(
        res,
        {
          notifications,
          totalCount,
          activePage: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
        "Notifications sent successfully"
      );
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

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
    // const { title, image, handle, child, parent, wantImage } = req.body;

    // if (parent) {
    //   const parentSidebar = await SidebarModel.findById(parent);
    //   if (!parentSidebar) {
    //     return NOT_FOUND(res, "Parent sidebar not found");
    //   }
    //   const newSidebar = (await SidebarModel.create({
    //     title,
    //     image,
    //     handle,
    //     child,
    //     wantImage,
    //   })) as any;
    //   parentSidebar.child.push(newSidebar._id);
    //   await parentSidebar.save();
    //   return CREATED(res, newSidebar);
    // } else {
    //   const data = await SidebarModel.create({
    //     title,
    //     image,
    //     handle,
    //     child,
    //     isPrime: true,
    //     wantImage,
    //   });
    //   return OK(res, data);
    // }

    const { type, id, title, parent, image, handle } = req.body;

    if (![1, 2, 3].includes(type)) {
      return BADREQUEST(res, "Invalid Type");
    }

    if ((type == 2 || type == 3) && !parent) {
      return BADREQUEST(res, "Parent ID is required for type 2 and 3");
    }

    if (type === 1 && id) {
      await SidebarModel1.findByIdAndUpdate(id, { title, image, handle });
      const updatedSidebar = await SidebarModel1.findById(id);
      return OK(res, updatedSidebar);
    } else if (type === 1 && !id) {
      const order = (await SidebarModel1.countDocuments()) + 1;
      const data = await SidebarModel1.create({ title, image, handle, order });
      return CREATED(res, data);
    } else if (type === 2 && id) {
      const previousSidebar = await SidebarModel2.findById(id);
      if (image !== previousSidebar?.image) {
        if (previousSidebar?.image) {
          await deleteFileFromS3(previousSidebar?.image);
        }
      }
      await SidebarModel2.findByIdAndUpdate(id, { title, image, handle });
      const updatedSidebar = await SidebarModel2.findById(id);
      return OK(res, updatedSidebar);
    } else if (type === 2 && !id) {
      const parentSidebar = await SidebarModel1.findById(parent);
      if (!parentSidebar) {
        return NOT_FOUND(res, "Parent sidebar not found");
      }
      const order = (await SidebarModel2.countDocuments({ parent })) + 1;
      const newSidebar = (await SidebarModel2.create({
        title,
        image,
        handle,
        order,
        parent,
      })) as any;

      return CREATED(res, newSidebar);
    } else if (type === 3 && id) {
      const previousSidebar = await SidebarModel3.findById(id);
      if (image !== previousSidebar?.image) {
        if (previousSidebar?.image) {
          await deleteFileFromS3(previousSidebar?.image);
        }
      }
      await SidebarModel3.findByIdAndUpdate(id, { title, image, handle });
      const updatedSidebar = await SidebarModel3.findById(id);
      return OK(res, updatedSidebar);
    } else if (type === 3 && !id) {
      const parentSidebar = await SidebarModel2.findById(parent);
      if (!parentSidebar) {
        return NOT_FOUND(res, "Parent sidebar not found");
      }
      const order = (await SidebarModel3.countDocuments({ parent })) + 1;
      const newSidebar = (await SidebarModel3.create({
        title,
        image,
        handle,
        order,
        parent,
      })) as any;

      return CREATED(res, newSidebar);
    }
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

router.get("/sidebar", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const response = await SidebarModel1.aggregate([
      // Sort level 1 (Sidebar1)
      { $sort: { order: 1 } },

      // Level 1 Lookup: Sidebar1 → Sidebar2
      {
        $lookup: {
          from: "sidebar2",
          localField: "_id",
          foreignField: "parent",
          as: "child",
        },
      },

      // Sort Sidebar2 children
      {
        $addFields: {
          child: {
            $sortArray: { input: "$child", sortBy: { order: 1 } },
          },
        },
      },

      // Level 2 Lookup: Sidebar2 → Sidebar3
      {
        $lookup: {
          from: "sidebar3",
          localField: "child._id",
          foreignField: "parent",
          as: "childLevel2",
        },
      },

      // Merge Sidebar3 into its corresponding Sidebar2
      {
        $addFields: {
          child: {
            $map: {
              input: "$child",
              as: "c",
              in: {
                $mergeObjects: [
                  "$$c",
                  {
                    child: {
                      $filter: {
                        input: "$childLevel2",
                        as: "cl2",
                        cond: { $eq: ["$$cl2.parent", "$$c._id"] },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // Sort Sidebar3 children inside each Sidebar2
      {
        $addFields: {
          child: {
            $map: {
              input: "$child",
              as: "c",
              in: {
                $mergeObjects: [
                  "$$c",
                  {
                    child: {
                      $sortArray: {
                        input: "$$c.child",
                        sortBy: { order: 1 },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },

      { $unset: "childLevel2" },
    ]);

    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

router.patch("/sidebar", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const { type, from = {}, to = {} } = req.body;

    if (![1, 2, 3].includes(type)) {
      return BADREQUEST(res, "Invalid Type");
    }

    if (from.id === to.id) {
      return OK(res, {});
    }

    if (type === 1) {
      await SidebarModel1.findByIdAndUpdate(from.id, { order: to.order });
      await SidebarModel1.findByIdAndUpdate(to.id, { order: from.order });
    } else if (type === 2) {
      await SidebarModel2.findByIdAndUpdate(from.id, { order: to.order });
      await SidebarModel2.findByIdAndUpdate(to.id, { order: from.order });
    } else if (type === 3) {
      await SidebarModel3.findByIdAndUpdate(from.id, { order: to.order });
      await SidebarModel3.findByIdAndUpdate(to.id, { order: from.order });
    }

    return OK(res, {});
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

async function reorderItems(model: any, parentId: any = null) {
  const items = await model.find({ parent: parentId }).sort({ order: 1 });

  const bulkOps = items
    .map((item: any, index: any) => {
      const newOrder = index + 1;
      if (item.order !== newOrder) {
        return {
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { order: newOrder } },
          },
        };
      }
      return null;
    })
    .filter(Boolean);

  if (bulkOps.length > 0) {
    await model.bulkWrite(bulkOps);
  }
}

// router.delete(
//   "/sidebar/:id",
//   checkUserAuth,
//   async (req: Request, res: Response) => {
//     try {
//       const { id } = req.params;

//       // DELETE FROM SIDEBAR1
//       let deleted: any = (await SidebarModel1.findByIdAndDelete(id)) as any;
//       if (deleted) {
//         await reorderItems(SidebarModel1);
//         return OK(res, {}, "Sidebar deleted successfully");
//       }

//       // DELETE FROM SIDEBAR2
//       deleted = (await SidebarModel2.findByIdAndDelete(id)) as any;
//       if (deleted) {
//         if (deleted?.image) await deleteFileFromS3(deleted?.image);
//         await reorderItems(SidebarModel2);
//         return OK(res, {}, "Sidebar deleted successfully");
//       }

//       // DELETE FROM SIDEBAR3
//       deleted = (await SidebarModel3.findByIdAndDelete(id)) as any;
//       if (deleted) {
//         if (deleted?.image) await deleteFileFromS3(deleted?.image);
//         await reorderItems(SidebarModel3);
//         return OK(res, {}, "Sidebar deleted successfully");
//       }

//       return NOT_FOUND(res, "Sidebar not found");
//     } catch (error) {
//       return INTERNAL_SERVER_ERROR(res, error);
//     }
//   }
// );

router.delete(
  "/sidebar/:id",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Attempt deletion from all models in parallel
      const [deleted1, deleted2, deleted3] = await Promise.all([
        SidebarModel1.findByIdAndDelete(id),
        SidebarModel2.findByIdAndDelete(id),
        SidebarModel3.findByIdAndDelete(id),
      ]);

      // Determine which model had the item and handle cleanup
      if (deleted1) {
        await reorderItems(SidebarModel1);
        return OK(res, {}, "Sidebar deleted successfully");
      }

      if (deleted2) {
        if (deleted2.image) {
          await Promise.all([
            reorderItems(SidebarModel2, deleted2?.parent),
            deleteFileFromS3(deleted2.image),
          ]);
        } else {
          await reorderItems(SidebarModel2, deleted2?.parent);
        }
        return OK(res, {}, "Sidebar deleted successfully");
      }

      if (deleted3) {
        if (deleted3.image) {
          await Promise.all([
            reorderItems(SidebarModel3, deleted3.parent),
            deleteFileFromS3(deleted3.image),
          ]);
        } else {
          await reorderItems(SidebarModel3, deleted3.parent);
        }
        return OK(res, {}, "Sidebar deleted successfully");
      }

      return NOT_FOUND(res, "Sidebar not found");
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

// Homepage routes
router.get("/homepage", checkUserAuth, async (req: Request, res: Response) => {
  try {
    let response: any = await HomepageModel.findOne()
      .select("-id -__v -createdAt -updatedAt")
      .lean();

    if (!response) return OK(res, {});

    // Sort arrays by "order" field
    if (response.banners?.length) {
      response.banners = response.banners.sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );
    }

    if (response.styles?.length) {
      response.styles = response.styles.sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );
    }

    if (response.fabrics?.length) {
      response.fabrics = response.fabrics.sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );
    }

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
        fabrics: [],
      });
    }

    const getNextOrder = (arr: any[]) => (arr?.length || 0) + 1;

    if (type === "banner") {
      const nextOrder = getNextOrder(checkHomeExist?.banners || []);
      const response = await HomepageModel.findOneAndUpdate(
        {},
        {
          $push: {
            banners: { title, description, image, handle, order: nextOrder },
          },
        },
        { new: true }
      ).select("-id -__v -createdAt -updatedAt");

      return OK(res, response);
    } else if (type === "style") {
      const nextOrder = getNextOrder(checkHomeExist?.styles || []);
      const response = await HomepageModel.findOneAndUpdate(
        {},
        { $push: { styles: { title, image, handle, order: nextOrder } } },
        { new: true }
      ).select("-id -__v -createdAt -updatedAt");
      return OK(res, response);
    } else if (type === "fabric") {
      const nextOrder = getNextOrder(checkHomeExist?.fabrics || []);
      const response = await HomepageModel.findOneAndUpdate(
        {},
        {
          $push: {
            fabrics: { title, image, handle, fabricName, order: nextOrder },
          },
        },
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

router.patch(
  "/homepage",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { type } = req.query;

      const { id, title, description, image, handle, fabricName } = req.body;

      if (!id) return NOT_FOUND(res, "ID is required");

      if (type === "banner") {
        const homepage: any = await HomepageModel.findOne();
        const banner = homepage.banners.id(id);
        if (!banner) return NOT_FOUND(res, "Banner not found");
        if (banner.image !== image) {
          if (banner.image) await deleteFileFromS3(banner.image);
        }
        banner.title = title || banner.title;
        banner.description = description || banner.description;
        banner.image = image || banner.image;
        banner.handle = handle || banner.handle;
        const response = await homepage.save();
        return OK(res, response);
      } else if (type === "style") {
        const homepage: any = await HomepageModel.findOne();
        const style = homepage.styles.id(id);
        if (!style) return NOT_FOUND(res, "Style not found");
        if (style.image !== image) {
          if (style.image) await deleteFileFromS3(style.image);
        }
        style.title = title || style.title;
        style.image = image || style.image;
        style.handle = handle || style.handle;
        const response = await homepage.save();
        return OK(res, response);
      } else if (type === "fabric") {
        const homepage: any = await HomepageModel.findOne();
        const fabric = homepage.fabrics.id(id);
        if (!fabric) return NOT_FOUND(res, "Fabric not found");
        if (fabric.image !== image) {
          if (fabric.image) await deleteFileFromS3(fabric.image);
        }
        fabric.title = title || fabric.title;
        fabric.image = image || fabric.image;
        fabric.handle = handle || fabric.handle;
        fabric.fabricName = fabricName || fabric.fabricName;
        const response = await homepage.save();
        return OK(res, response);
      } else {
        return NOT_FOUND(res, "Valid type is required");
      }
    } catch (error) {
      return INTERNAL_SERVER_ERROR(res, error);
    }
  }
);

router.put("/homepage", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const { type, from = {}, to = {} } = req.body;
    if (!["banners", "styles", "fabrics"].includes(type)) {
      return BADREQUEST(res, "Invalid Type");
    }

    if (from.id === to.id) {
      return OK(res, {});
    }

    const homepage: any = await HomepageModel.findOne();
    const fromItem = homepage[type].id(from.id);
    const toItem = homepage[type].id(to.id);
    if (!fromItem || !toItem) {
      return NOT_FOUND(res, `${type.slice(0, -1)} not found`);
    }
    const tempOrder = fromItem.order;
    fromItem.order = toItem.order;
    toItem.order = tempOrder;
    const response = await homepage.save();
    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

async function reorderHomepageArray(modelArray: any[]) {
  return modelArray
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((item: any, index: number) => ({
      ...item,
      order: index + 1,
    }));
}

router.delete(
  "/homepage",
  checkUserAuth,
  async (req: Request, res: Response) => {
    try {
      const { type, id } = req.query;

      if (!id) return NOT_FOUND(res, "ID is required");

      let homepage: any = await HomepageModel.findOne();
      if (!homepage) return NOT_FOUND(res, "Homepage not found");

      // 🟢 DELETE BANNER
      if (type === "banner") {
        const selected = homepage.banners.find(
          (b: any) => b._id.toString() === id
        );
        if (!selected) return NOT_FOUND(res, "Banner not found");

        if (selected.image) await deleteFileFromS3(selected.image);

        homepage.banners = homepage.banners.filter(
          (b: any) => b._id.toString() !== id
        );

        homepage.banners = await reorderHomepageArray(homepage.banners);
      }

      // 🟢 DELETE STYLE
      else if (type === "style") {
        const selected = homepage.styles.find(
          (s: any) => s._id.toString() === id
        );
        if (!selected) return NOT_FOUND(res, "Style not found");

        if (selected.image) await deleteFileFromS3(selected.image);

        homepage.styles = homepage.styles.filter(
          (s: any) => s._id.toString() !== id
        );

        homepage.styles = await reorderHomepageArray(homepage.styles);
      }

      // 🟢 DELETE FABRIC
      else if (type === "fabric") {
        const selected = homepage.fabrics.find(
          (f: any) => f._id.toString() === id
        );
        if (!selected) return NOT_FOUND(res, "Fabric not found");

        if (selected.image) await deleteFileFromS3(selected.image);

        homepage.fabrics = homepage.fabrics.filter(
          (f: any) => f._id.toString() !== id
        );

        homepage.fabrics = await reorderHomepageArray(homepage.fabrics);
      }

      // ❌ INVALID TYPE
      else {
        return NOT_FOUND(res, "Valid type is required (banner/style/fabric)");
      }

      const response = await homepage.save();
      return OK(res, response);
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
      const { title, pointers, description, handle, link, image, id, typeId } =
        req.body;

      if (!id) return NOT_FOUND(res, "Style guide ID is required");
      const styleGuid: any = await StyleGuidModel.findById(id);

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
        if (typeId) {
          const lengthItem = styleGuid.lengths.id(typeId);
          if (!lengthItem) {
            return NOT_FOUND(res, "Length item not found");
          }
          if (lengthItem.image !== image) {
            await deleteFileFromS3(lengthItem.image);
          }
          lengthItem.image = image;
          lengthItem.title = title || lengthItem.title;
          lengthItem.description = description || lengthItem.description;
          lengthItem.pointers = pointers || lengthItem.pointers;
          lengthItem.handle = handle || lengthItem.handle;
          await styleGuid.save();
          return OK(res, styleGuid);
        } else {
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
        }
      } else if (type === "paring") {
        if (typeId) {
          const paringItem = styleGuid.paring.id(typeId);
          if (!paringItem) {
            return NOT_FOUND(res, "Paring item not found");
          }
          if (paringItem.image !== image) {
            await deleteFileFromS3(paringItem.image);
          }
          paringItem.image = image;
          paringItem.title = title || paringItem.title;
          paringItem.handle = handle || paringItem.handle;
          await styleGuid.save();
          return OK(res, styleGuid);
        } else {
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
        }
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

// Promo Codes route
// router.post("/promocode1", async (req: Request, res: Response) => {
//   try {
//     let {
//       title,
//       target_type,
//       target_selection,
//       allocation_method,
//       value_type,
//       value,
//       usage_limit,
//       starts_at,
//       ends_at,
//       code,
//     } = req.body;

//     value = Number(value);
//     usage_limit = usage_limit ? Number(usage_limit) : null;

//     // ---------- VALIDATIONS ----------
//     if (!title || !code) {
//       return BADREQUEST(res, "Title and code are required.");
//     }

//     const allowedTargetTypes = ["line_item", "shipping_line"];
//     if (!allowedTargetTypes.includes(target_type)) {
//       return BADREQUEST(res, "Invalid target_type.");
//     }

//     const allowedTargetSelections = ["all", "entitled"];
//     if (!allowedTargetSelections.includes(target_selection)) {
//       return BADREQUEST(res, "Invalid target_selection.");
//     }

//     const allowedAllocMethods = ["across", "each"];
//     if (!allowedAllocMethods.includes(allocation_method)) {
//       return BADREQUEST(res, "Invalid allocation_method.");
//     }

//     const allowedValueTypes = ["percentage", "fixed_amount"];
//     if (!allowedValueTypes.includes(value_type)) {
//       return BADREQUEST(res, "Invalid value_type.");
//     }

//     // Value validations
//     if (typeof value !== "number" || value <= 0) {
//       return BADREQUEST(res, "Value must be a positive number.");
//     }

//     if (value_type === "percentage" && (value < 1 || value > 99)) {
//       return BADREQUEST(res, "Percentage discount must be between 1 and 99.");
//     }

//     // date validation
//     if (!starts_at || !ends_at)
//       return BADREQUEST(res, "starts_at and ends_at are required.");

//     const startUTC = new Date(starts_at);
//     const endUTC = new Date(ends_at);

//     if (isNaN(startUTC.getTime()) || isNaN(endUTC.getTime())) {
//       return BADREQUEST(res, "Invalid UTC date format.");
//     }

//     if (startUTC >= endUTC) {
//       return BADREQUEST(res, "starts_at must be before ends_at.");
//     }

//     // Shopify requires discount value to be NEGATIVE
//     const shopifyValue = -Math.abs(value);

//     // ---------- CREATE PRICE RULE IN SHOPIFY ----------
//     const priceRulePayload = {
//       price_rule: {
//         title,
//         target_type,
//         target_selection,
//         allocation_method,
//         value_type,
//         value: `${shopifyValue.toFixed(1)}`, // Shopify wants string
//         usage_limit: usage_limit || null,
//         customer_selection: "all",
//         starts_at: startUTC.toISOString(),
//         ends_at: endUTC.toISOString(),
//       },
//     };

//     console.log(
//       priceRulePayload,
//       `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules.json`
//     );

//     const priceRuleResponse = await axios.post(
//       `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules.json`,
//       priceRulePayload,
//       {
//         headers: {
//           "X-Shopify-Access-Token": process.env.X_SHOPIFY_ACESS_TOKEN,
//         },
//       }
//     );

//     const priceRuleId = priceRuleResponse.data.price_rule.id;

//     // ---------- CREATE DISCOUNT CODE ----------
//     const discountPayload = {
//       discount_code: { code },
//     };

//     const discountResponse = await axios.post(
//       `${process.env.SHOPIFY_ADMIN_API_URL}/price_rules/${priceRuleId}/discount_codes.json`,
//       discountPayload,
//       {
//         headers: {
//           "X-Shopify-Access-Token": process.env.X_SHOPIFY_ACESS_TOKEN,
//         },
//       }
//     );

//     return OK(res, {
//       message: "Promocode created successfully",
//       price_rule: priceRuleResponse.data.price_rule,
//       discount_code: discountResponse.data.discount_code,
//     });
//   } catch (error: any) {
//     return INTERNAL_SERVER_ERROR(res, error?.response?.data || error);
//   }
// });

router.post("/promocode", async (req: Request, res: Response) => {
  try {
    const {
      title,
      target_type,
      target_selection,
      allocation_method,
      value_type,
      value,
      usage_limit,
      starts_at,
      ends_at,
      code,
    } = req.body;

    // ---------- BASIC VALIDATIONS ----------
    if (!title || !code) {
      return BADREQUEST(res, "Title and code are required.");
    }

    if (!starts_at || !ends_at) {
      return BADREQUEST(res, "starts_at and ends_at are required.");
    }

    const allowedTargetTypes = ["line_item", "shipping_line"];
    const allowedTargetSelections = ["all", "entitled"];
    const allowedAllocMethods = ["across", "each"];
    const allowedValueTypes = ["percentage", "fixed_amount"];

    if (!allowedTargetTypes.includes(target_type))
      return BADREQUEST(res, "Invalid target_type.");

    if (!allowedTargetSelections.includes(target_selection))
      return BADREQUEST(res, "Invalid target_selection.");

    if (!allowedAllocMethods.includes(allocation_method))
      return BADREQUEST(res, "Invalid allocation_method.");

    if (!allowedValueTypes.includes(value_type))
      return BADREQUEST(res, "Invalid value_type.");

    const numericValue = Number(value);
    if (!numericValue || numericValue <= 0)
      return BADREQUEST(res, "Value must be a positive number.");

    if (value_type === "percentage" && (numericValue < 1 || numericValue > 99))
      return BADREQUEST(res, "Percentage must be between 1 and 99.");

    const usageLimitNumber = usage_limit ? Number(usage_limit) : null;

    // ---------- DATE VALIDATION ----------
    const startUTC = new Date(starts_at);
    const endUTC = new Date(ends_at);

    if (isNaN(startUTC.getTime()) || isNaN(endUTC.getTime())) {
      return BADREQUEST(res, "Invalid date format.");
    }

    if (startUTC >= endUTC) {
      return BADREQUEST(res, "starts_at must be before ends_at.");
    }

    // Shopify requires NEGATIVE discount value internally
    const shopifyValue = -Math.abs(numericValue);

    // ---------- PRICE RULE PAYLOAD ----------
    const priceRulePayload = {
      price_rule: {
        title,
        target_type,
        target_selection,
        allocation_method,
        value_type,
        value: shopifyValue.toString(), // Shopify requires string
        usage_limit: usageLimitNumber,
        customer_selection: "all",
        starts_at: startUTC.toISOString(),
        ends_at: endUTC.toISOString(),
      },
    };

    const BASE_URL = process.env.SHOPIFY_ADMIN_API_BASE_URL;
    const TOKEN = process.env.X_SHOPIFY_ACESS_TOKEN;

    if (!BASE_URL || !TOKEN) {
      return INTERNAL_SERVER_ERROR(
        res,
        "Missing Shopify environment variables"
      );
    }

    // ---------- CREATE PRICE RULE ----------
    const priceRuleResponse = await axios.post(
      `${BASE_URL}/price_rules.json`,
      priceRulePayload,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const priceRuleId = priceRuleResponse.data.price_rule.id;

    // ---------- CREATE DISCOUNT CODE ----------
    const discountPayload = {
      discount_code: { code },
    };

    const discountResponse = await axios.post(
      `${BASE_URL}/price_rules/${priceRuleId}/discount_codes.json`,
      discountPayload,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const runningJob = await SyncJobModel.findOne({
      status: { $in: ["PENDING", "RUNNING"] },
    });

    if (runningJob) return;

    const job: any = await SyncJobModel.create({ status: "PENDING" });
    const TWO_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    setTimeout(async () => {
      await syncPromoCodes(job._id.toString(), TWO_MINUTES_AGO);
      return OK(res, {
        message: "Promocode created successfully",
        price_rule: priceRuleResponse.data.price_rule,
        discount_code: discountResponse.data.discount_code,
      });
    }, 5000);
  } catch (error: any) {
    if (error?.response?.data?.errors?.code?.[0]) {
      return BADREQUEST(res, error?.response?.data?.errors?.code[0]);
    }
    return INTERNAL_SERVER_ERROR(res, error?.response?.data || error);
  }
});

// Get all coupons with their price rules
// router.get("/promocode", async (req, res) => {
//   try {
//     const headers = {
//       "X-Shopify-Access-Token": process.env.X_SHOPIFY_ACESS_TOKEN,
//       "Content-Type": "application/json",
//     };

//     // 1. Fetch ALL price rules
//     const rulesRes = await axios.get(
//       `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules.json`,
//       { headers }
//     );

//     const priceRules = rulesRes.data.price_rules || [];

//     if (priceRules.length === 0) {
//       return OK(res, []);
//     }

// const wait = (ms: number) => new Promise((res) => res(ms));

// const batchSize = 3;
// let results: any[] = [];

// for (let i = 0; i < priceRules.length; i += batchSize) {
//   const batch = priceRules.slice(i, i + batchSize);

//   const batchResults = await Promise.all(
//     batch.map(async (rule: any) => {
//       try {
//         const r = await axios.get(
//           `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules/${rule.id}/discount_codes.json`,
//           { headers }
//         );

//         return { rule, discount_codes: r.data.discount_codes || [] };
//       } catch (err) {
//         console.log("Rate-limit hit for rule:", rule.id);
//         await wait(500);
//         return { rule, discount_codes: [] };
//       }
//     })
//   );

//   results = results.concat(batchResults);

//   // wait between batches to avoid Shopify throttling
//   await wait(300);
// }

//     // 3. FILTER → remove rules that have 0 discount codes
//     const filtered = results.filter((item) => item.discount_codes.length > 0);

//     return OK(res, { count: filtered.length, filtered });
//   } catch (err : any) {
//     console.log(err?.response?.data || err);
//     return INTERNAL_SERVER_ERROR(res, err?.response?.data || err);
//   }
// });

router.get("/promocode", async (req, res) => {
  try {
    let { page = 1, limit = 50 } = req.query;
    page = Number(page);
    limit = Number(limit);
    const data = await PromoCodeModel.find()
      .skip(((Number(page) || 1) - 1) * (Number(limit) || 10))
      .limit(Number(limit) || 10)
      .sort({ createdAt: -1 })
      .lean();

    const totalCount = await PromoCodeModel.countDocuments();
    const totalPage = Math.ceil(totalCount / limit);

    return OK(res, { count: totalCount, totalPage, limit, data });
  } catch (err: any) {
    console.log(err?.response?.data || err);
    return INTERNAL_SERVER_ERROR(res, err?.response?.data || err);
  }
});

router.delete(
  "/promocode/:priceRuleId",
  async (req: Request, res: Response) => {
    try {
      const { priceRuleId } = req.params;

      const BASE_URL = process.env.SHOPIFY_ADMIN_API_BASE_URL;
      const TOKEN = process.env.X_SHOPIFY_ACESS_TOKEN;

      if (!BASE_URL || !TOKEN) {
        return INTERNAL_SERVER_ERROR(res, "Missing Shopify env variables");
      }

      const headers = {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      };

      // STEP 1 — Get discount codes inside this rule
      const codesRes = await axios.get(
        `${BASE_URL}/price_rules/${priceRuleId}/discount_codes.json`,
        { headers }
      );

      const discountCodes = codesRes.data.discount_codes;

      // STEP 2 — Delete all discount codes under the rule
      for (const code of discountCodes) {
        await axios.delete(
          `${BASE_URL}/price_rules/${priceRuleId}/discount_codes/${code.id}.json`,
          { headers }
        );
      }

      // STEP 3 — Delete the price rule itself
      await axios.delete(`${BASE_URL}/price_rules/${priceRuleId}.json`, {
        headers,
      });

      await PromoCodeModel.findOneAndDelete({ shopifyRuleId: priceRuleId });

      return OK(res, {
        message: "Promocode deleted successfully",
        deleted_price_rule_id: priceRuleId,
        deleted_codes: discountCodes.map((c: any) => c.code),
      });
    } catch (error: any) {
      if (error?.response?.data?.errors) {
        return BADREQUEST(res, error?.response?.data?.errors);
      }
      return INTERNAL_SERVER_ERROR(res, error?.response?.data || error);
    }
  }
);

export { router as admin };
