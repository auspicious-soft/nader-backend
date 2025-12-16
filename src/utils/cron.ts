import cron from "node-cron";
import axios from "axios";
import { fetchCollectionsList } from "./fetch-collections.js";
import { CollectionModel } from "../models/collection-schema.js";
import { SyncJobModel } from "../models/sync-job-schema.js";
import { PromoCodeModel } from "../models/promocodes-schema.js";

async function updateCollections() {
  console.warn("⚠️ [Cron] Running Collection Updates...");

  try {
    const data: { id: string; title: string; handle: string }[] = [];

    // Recursive fetch
    async function run(endCursor: string | null = null) {
      const res: any = await fetchCollectionsList(250, endCursor);
      const list = res?.data?.collections;
      // console.warn(list);

      if (list?.nodes?.length) {
        const filtered = list.nodes.map((col: any) => ({
          id: col.id,
          title: col.title,
          handle: col.handle,
          image: col?.image?.originalSrc || null,
        }));
        data.push(...filtered);
      }

      if (list?.pageInfo?.hasNextPage && list?.pageInfo?.endCursor) {
        await run(list.pageInfo.endCursor);
      }
    }

    await run();
    console.warn(`✅ Total collections fetched: ${data.length}`);

    if (data.length > 0) {
      const bulkOps = data.map((item) => ({
        updateOne: {
          filter: { id: item.id },
          update: { $set: item },
          upsert: true,
        },
      }));

      await CollectionModel.bulkWrite(bulkOps, {
        ordered: false,
      });
    }
  } catch (err) {
    console.error("❌ [Cron] Collection update error:", err);
  }
}

export const CollectionUpdates = async () => {
  // 1️⃣ Run immediately on server start
  await updateCollections();

  // 2️⃣ Schedule to run every 24 hours (at midnight)
  cron.schedule("0 0 * * *", async () => {
    await updateCollections();
  });
};

const headers = {
  "X-Shopify-Access-Token": process.env.X_SHOPIFY_ACESS_TOKEN!,
  "Content-Type": "application/json",
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getNext(link?: string) {
  if (!link) return null;
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function shopifyGet(url: string, retries = 5): Promise<any> {
  try {
    return await axios.get(url, { headers });
  } catch (err: any) {
    if (err.response?.status === 429 && retries > 0) {
      const retryAfter =
        Number(err.response.headers["retry-after"]) * 1000 || 1000;
      await wait(retryAfter);
      return shopifyGet(url, retries - 1);
    }
    throw err;
  }
}

export async function syncPromoCodes(jobId: string) {
  const job = await SyncJobModel.findById(jobId);
  if (!job) return;

  // 🚫 Prevent parallel jobs
  const runningJob = await SyncJobModel.findOne({
    _id: { $ne: jobId },
    status: { $in: ["PENDING", "RUNNING"] },
  });

  if (runningJob) {
    job.status = "FAILED";
    job.error = "Another sync already running";
    await job.save();
    return;
  }

  const syncRunId = new Date().toISOString();

  try {
    job.status = "RUNNING";
    job.startedAt = new Date();
    await job.save();

    const THIRTY_DAYS_AGO = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    let ruleUrl : any =
      `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules.json` +
      `?limit=250&created_at_min=${THIRTY_DAYS_AGO}`;

    while (ruleUrl) {
      const ruleRes = await shopifyGet(ruleUrl);
      const rules = ruleRes.data.price_rules || [];
      ruleUrl = getNext(ruleRes.headers.link);

      for (const rule of rules) {
        let codeUrl: any = `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules/${rule.id}/discount_codes.json?limit=250`;

        while (codeUrl) {
          const codeRes = await shopifyGet(codeUrl);
          const codes = codeRes.data.discount_codes || [];
          codeUrl = getNext(codeRes.headers.link);

          if (codes.length) {
            await PromoCodeModel.bulkWrite(
              codes.map((c: any) => ({
                updateOne: {
                  filter: { shopifyCodeId: c.id },
                  update: {
                    $set: {
                      shopifyRuleId: rule.id,
                      shopifyCodeId: c.id,
                      code: c.code,
                      ruleTitle: rule.title,
                      startsAt: rule.starts_at,
                      endsAt: rule.ends_at,
                      value: rule.value,
                      valueType: rule.value_type,
                      usageLimit: rule.usage_limit,
                      usageCount: c.usage_count,
                      updatedAt: new Date(),
                    },
                  },
                  upsert: true,
                },
              }))
            );
          }
        }

        await wait(200); // Shopify-safe pacing
      }
    }

    // 🧹 Atomic swap (delete old data ONLY after success)
    // await PromoCodeModel.deleteMany({ syncRunId: { $ne: syncRunId } });

    job.status = "COMPLETED";
    job.completedAt = new Date();
    await job.save();
  } catch (err: any) {
    job.status = "FAILED";
    job.error = err.message;
    await job.save();
  }
}

// 🔁 Run once on server startup
(async () => {
  const runningJob = await SyncJobModel.findOne({
    status: { $in: ["PENDING", "RUNNING"] },
  });
  console.warn(runningJob);
  if (!runningJob) {
    const job : any = await SyncJobModel.create({ status: "PENDING" });
    syncPromoCodes(job._id.toString());
  }
})();

// ⏰ Run daily at 2 AM IST
cron.schedule(
  "0 2 * * *",
  async () => {
    const runningJob = await SyncJobModel.findOne({
      status: { $in: ["PENDING", "RUNNING"] },
    });

    if (runningJob) return;

    const job : any = await SyncJobModel.create({ status: "PENDING" });
    syncPromoCodes(job._id.toString());
  },
  { timezone: "Asia/Kolkata" }
);

// const headers = {
//   "X-Shopify-Access-Token": process.env.X_SHOPIFY_ACESS_TOKEN!,
//   "Content-Type": "application/json",
// };

// const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// function getNext(link?: string) {
//   if (!link) return null;
//   const match = link.match(/<([^>]+)>;\s*rel="next"/);
//   return match ? match[1] : null;
// }

// async function shopifyGet(url: string, retries = 5): Promise<any> {
//   try {
//     return await axios.get(url, { headers });
//   } catch (err: any) {
//     if (err.response?.status === 429 && retries > 0) {
//       const retryAfter =
//         Number(err.response.headers["retry-after"]) * 1000 || 1000;
//       await wait(retryAfter);
//       return shopifyGet(url, retries - 1);
//     }
//     throw err;
//   }
// }

// export async function syncPromoCodes(jobId: string) {
//   const job = await SyncJobModel.findById(jobId);
//   if (!job) return;

//   try {
//     job.status = "RUNNING";
//     job.startedAt = new Date();
//     await job.save();

//     // 1️⃣ Full refresh (safe & simple)
//     await PromoCodeModel.deleteMany({});

//     let ruleUrl = `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules.json?limit=250`;

//     while (ruleUrl) {
//       const ruleRes = await shopifyGet(ruleUrl);
//       const rules = ruleRes.data.price_rules || [];
//       ruleUrl = getNext(ruleRes.headers.link);

//       for (const rule of rules) {
//         let codeUrl = `${process.env.SHOPIFY_ADMIN_API_BASE_URL}/price_rules/${rule.id}/discount_codes.json?limit=250`;

//         while (codeUrl) {
//           const codeRes = await shopifyGet(codeUrl);
//           const codes = codeRes.data.discount_codes || [];
//           codeUrl = getNext(codeRes.headers.link);

//           if (codes.length) {
//             await PromoCodeModel.insertMany(
//               codes.map((c: any) => ({
//                 shopifyRuleId: rule.id,
//                 shopifyCodeId: c.id,
//                 code: c.code,
//                 ruleTitle: rule.title,
//                 startsAt: rule.starts_at,
//                 endsAt: rule.ends_at,
//                 value: rule.value,
//                 valueType: rule.value_type,
//                 usageLimit: rule.usage_limit,
//                 usageCount: c.usage_count,
//               })),
//               { ordered: false }
//             );
//           }
//         }
//         await wait(200);
//       }
//     }

//     job.status = "COMPLETED";
//     job.completedAt = new Date();
//     await job.save();
//   } catch (err: any) {
//     job.status = "FAILED";
//     job.error = err.message;
//     await job.save();
//   }
// }

// cron.schedule("0 2 * * *", async () => {
//   const job = await SyncJobModel.create({ status: "PENDING" });
//   syncPromoCodes(job?._id.toString());
// });
