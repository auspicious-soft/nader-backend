import cron from "node-cron";
import { fetchCollectionsList } from "./fetch-collections.js";
import { CollectionModel } from "../models/collection-schema.js";

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
          image: col?.image?.originalSrc || null
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
