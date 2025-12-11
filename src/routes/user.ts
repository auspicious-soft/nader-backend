import { Router, Request, Response, NextFunction } from "express";
import { INTERNAL_SERVER_ERROR, OK, UNAUTHORIZED } from "../utils/response.js";
import { SidebarModel } from "../models/sidebar-schema.js";
import { HomepageModel } from "../models/homepage.js";
import { StyleGuidModel } from "../models/style-guid.js";
import { ENV } from "../config/env.js";
import { fcmTokenModel } from "../models/fcmToken.js";
import { SidebarModel1 } from "../models/sidebar1-schema.js";
import { SidebarModel3 } from "../models/sidebar3-schema.js";

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
    // const response = await SidebarModel.find({ isPrime: true })
    //   .populate({
    //     path: "child",
    //     select: "-__v -createdAt -updatedAt",
    //     populate: {
    //       path: "child",
    //       select: "-__v -createdAt -updatedAt",
    //       populate: {
    //         path: "child",
    //         select: "-__v -createdAt -updatedAt",
    //       },
    //     },
    //   })
    //   .select("-__v -createdAt -updatedAt")
    //   .lean();

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

// Homepage routes
router.get("/homepage", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const doc = await HomepageModel.findOne()
      .select("-id -__v -createdAt -updatedAt")
      .lean();

    if (!doc) {
      return OK(res, { banners: [], styles: [], fabrics: [] });
    }

    // Use local ref to avoid repeated property access
    const { banners = [], styles = [], fabrics = [] } = doc;

    // EXTREMELY OPTIMIZED SORT — no reallocation
    const fastSort = (arr : any) =>
      arr.sort((a : any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    fastSort(banners);
    fastSort(styles);
    fastSort(fabrics);

    return OK(res, { ...doc, banners, styles, fabrics });
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

router.post("/fcmToken", checkUserAuth, async (req: Request, res: Response) => {
  try {
    const { fcmToken, type = "add" } = req.body;
    if (!["add", "remove"].includes(type)) {
      throw new Error("Invalid Type, Should be add/remove");
    }

    let response;

    if (type === "add") {
      response = await fcmTokenModel.findOneAndUpdate(
        { fcmToken },
        { $set: { fcmToken } },
        { new: true, upsert: true }
      );
    } else {
      response = await fcmTokenModel.findOneAndDelete({ fcmToken });
    }
    return OK(res, response);
  } catch (error) {
    return INTERNAL_SERVER_ERROR(res, error);
  }
});

// router.post("/test", checkUserAuth, async (req: Request, res: Response) => {
//   try {
//     const data = await SidebarModel.find({ isPrime: true })
//       .select("title child")
//       .lean();

//     // for(let val of data){
//     //   await SidebarModel1.create({_id: val._id, title : val.title})
//     // }

//     for (let val of data) {
//       if (val?.child) {
//         for (let val2 of val?.child) {
//           const childData = await SidebarModel.findById(val2).lean();
//           if (childData?.child.length) {
//             let counter = 1;
//             for (let val3 of childData.child) {
//               const childData2 = await SidebarModel.findById(val3).lean();
//               await SidebarModel3.create({
//                 ...childData2,
//                 parent: childData._id,
//                 order: counter
//               });
//               counter = counter + 1;
//             }
//           }
//         }
//       }
//     }

//     return OK(res, data);
//   } catch (error) {
//     return INTERNAL_SERVER_ERROR(res, error);
//   }
// });

export { router as user };
