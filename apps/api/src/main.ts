import cors from "cors";
import dayjs from "dayjs";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import { Prisma, PrismaClient, ReminderStatus, ReminderType } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 3000);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../..", "data");

app.use(cors());
app.use(express.json());

function clampDaysOwned(purchaseDate: Date) {
  const diff = dayjs().startOf("day").diff(dayjs(purchaseDate).startOf("day"), "day") + 1;
  return Math.max(1, diff);
}

function calcDailyCost(price: number, daysOwned: number) {
  if (!price || price <= 0) return 0;
  return Number((price / daysOwned).toFixed(2));
}

function toItemView(item: any) {
  const daysOwned = clampDaysOwned(item.purchaseDate);
  return {
    ...item,
    daysOwned,
    dailyCost: calcDailyCost(item.price, daysOwned),
  };
}

async function ensureSeed() {
  const count = await prisma.category.count();
  if (count === 0) {
    const defaults = ["衣物", "数码", "洗漱用品", "书本", "家居用品", "厨具", "消耗品", "其他"];
    await prisma.category.createMany({
      data: defaults.map((name, i) => ({ name, sortOrder: i + 1 })),
    });
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!settings) {
    await prisma.setting.create({
      data: {
        id: 1,
        defaultReminderTime: "09:00",
        toastEnabled: true,
        exportFormat: "json",
        highDailyCostThreshold: Number(process.env.HIGH_DAILY_COST_THRESHOLD ?? 5),
        idleDaysThreshold: Number(process.env.IDLE_DAYS_THRESHOLD ?? 60),
      },
    });
  }
}

const categorySchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().optional(),
});

const itemSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: z.number().int(),
  price: z.number().min(0),
  purchaseDate: z.string(),
  status: z.enum(["IN_USE", "IDLE", "REPLACE_SOON", "RESTOCK_SOON"]).default("IN_USE"),
  lastUsedAt: z.string().optional(),
  note: z.string().max(1000).optional(),
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "writedown-api" });
});

app.get("/api/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { items: true } } },
  });
  res.json(categories.map((c) => ({ ...c, count: c._count.items })));
});

app.post("/api/categories", async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

  try {
    const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.category.create({
      data: {
        ...parsed.data,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        color: parsed.data.color ?? "neutral",
      },
    });
    res.json(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "分类名称已存在" });
    }
    return res.status(500).json({ message: "创建分类失败" });
  }
});

app.patch("/api/categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

  try {
    const updated = await prisma.category.update({ where: { id }, data: parsed.data });
    res.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "分类名称已存在" });
    }
    return res.status(500).json({ message: "更新分类失败" });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "分类ID不合法" });
  }

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return res.status(404).json({ message: "分类不存在" });
  }

  const count = await prisma.item.count({ where: { categoryId: id } });
  if (count > 0) {
    return res.status(400).json({ message: "该分类下仍有物品，请先迁移或合并后再删除" });
  }

  await prisma.category.delete({ where: { id } });

  res.json({ success: true });
});

app.post("/api/categories/:id/merge", async (req, res) => {
  const sourceId = Number(req.params.id);
  const targetId = z.number().int().parse(req.body.targetCategoryId);

  if (!Number.isInteger(sourceId) || sourceId <= 0 || !Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "分类ID不合法" });
  }
  if (sourceId === targetId) {
    return res.status(400).json({ message: "不能合并到同一个分类" });
  }

  const [source, target] = await Promise.all([
    prisma.category.findUnique({ where: { id: sourceId } }),
    prisma.category.findUnique({ where: { id: targetId } }),
  ]);

  if (!source || !target) {
    return res.status(404).json({ message: "分类不存在" });
  }

  await prisma.$transaction([
    prisma.item.updateMany({ where: { categoryId: sourceId }, data: { categoryId: targetId } }),
    prisma.category.delete({ where: { id: sourceId } }),
  ]);

  res.json({ success: true, sourceId, targetId });
});

app.post("/api/categories/:id/migrate", async (req, res) => {
  const sourceId = Number(req.params.id);
  const targetId = z.number().int().parse(req.body.targetCategoryId);

  if (!Number.isInteger(sourceId) || sourceId <= 0 || !Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "分类ID不合法" });
  }
  if (sourceId === targetId) {
    return res.status(400).json({ message: "不能迁移到同一个分类" });
  }

  const [source, target] = await Promise.all([
    prisma.category.findUnique({ where: { id: sourceId } }),
    prisma.category.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) {
    return res.status(404).json({ message: "分类不存在" });
  }

  const result = await prisma.item.updateMany({
    where: { categoryId: sourceId },
    data: { categoryId: targetId },
  });

  res.json({ success: true, sourceId, targetId, movedCount: result.count });
});

app.patch("/api/categories/reorder", async (req, res) => {
  const orders = z.array(z.object({ id: z.number().int(), sortOrder: z.number().int() })).parse(req.body);
  await prisma.$transaction(
    orders.map((o) => prisma.category.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })),
  );
  res.json({ success: true });
});

app.get("/api/items", async (req, res) => {
  const { keyword, categoryId, status, sortBy = "updatedAt", sortOrder = "desc" } = req.query as Record<string, string>;

  const items = await prisma.item.findMany({
    where: {
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { category: { name: { contains: keyword } } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId: Number(categoryId) } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: { category: true },
    orderBy: [{ [sortBy]: sortOrder as "asc" | "desc" }],
  });

  const views = items.map(toItemView).sort((a, b) => {
    if (sortBy === "daysOwned") return sortOrder === "asc" ? a.daysOwned - b.daysOwned : b.daysOwned - a.daysOwned;
    if (sortBy === "dailyCost") return sortOrder === "asc" ? a.dailyCost - b.dailyCost : b.dailyCost - a.dailyCost;
    return 0;
  });

  res.json(views);
});

app.get("/api/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({ where: { id }, include: { category: true } });
  if (!item) return res.status(404).json({ message: "物品不存在" });
  res.json(toItemView(item));
});

app.post("/api/items", async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

  const data = parsed.data;
  const purchaseDate = new Date(data.purchaseDate);
  const created = await prisma.item.create({
    data: {
      ...data,
      purchaseDate,
      statusUpdatedAt: new Date(),
      lastUsedAt: data.status === "IN_USE" ? new Date() : null,
    },
    include: { category: true },
  });
  res.json(toItemView(created));
});

app.patch("/api/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

  const patch: any = { ...parsed.data };
  if (patch.purchaseDate) patch.purchaseDate = new Date(patch.purchaseDate);
  if (patch.lastUsedAt) patch.lastUsedAt = new Date(patch.lastUsedAt);
  if (patch.status) patch.statusUpdatedAt = new Date();

  const updated = await prisma.item.update({ where: { id }, data: patch, include: { category: true } });
  res.json(toItemView(updated));
});

app.delete("/api/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.item.delete({ where: { id } });
  res.json({ success: true });
});

app.patch("/api/items/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = z.enum(["IN_USE", "IDLE", "REPLACE_SOON", "RESTOCK_SOON"]).parse(req.body.status);
  const updated = await prisma.item.update({
    where: { id },
    data: {
      status,
      statusUpdatedAt: new Date(),
      ...(status === "IN_USE" ? { lastUsedAt: new Date() } : {}),
    },
    include: { category: true },
  });
  res.json(toItemView(updated));
});

app.patch("/api/items/:id/use", async (req, res) => {
  const id = Number(req.params.id);
  const updated = await prisma.item.update({
    where: { id },
    data: { lastUsedAt: new Date() },
    include: { category: true },
  });
  res.json(toItemView(updated));
});

app.get("/api/reminders", async (req, res) => {
  const { status, type, itemId } = req.query as Record<string, string>;
  const reminders = await prisma.reminder.findMany({
    where: {
      ...(status ? { status: status as ReminderStatus } : {}),
      ...(type ? { type: type as ReminderType } : {}),
      ...(itemId ? { itemId: Number(itemId) } : {}),
    },
    include: { item: true },
    orderBy: { dueAt: "asc" },
  });
  res.json(reminders);
});

app.patch("/api/reminders/complete-all", async (_req, res) => {
  const result = await prisma.reminder.updateMany({
    where: { status: { not: "DONE" } },
    data: { status: "DONE", doneAt: new Date() },
  });
  res.json({ success: true, count: result.count });
});

app.delete("/api/reminders", async (_req, res) => {
  const result = await prisma.reminder.deleteMany();
  res.json({ success: true, count: result.count });
});

app.patch("/api/reminders/:id/done", async (req, res) => {
  const id = Number(req.params.id);
  const updated = await prisma.reminder.update({
    where: { id },
    data: { status: "DONE", doneAt: new Date() },
  });
  res.json(updated);
});

app.patch("/api/reminders/:id/snooze", async (req, res) => {
  const id = Number(req.params.id);
  const until = z.string().parse(req.body.until);
  const updated = await prisma.reminder.update({
    where: { id },
    data: { status: "SNOOZED", snoozedUntil: new Date(until) },
  });
  res.json(updated);
});

app.get("/api/dashboard/summary", async (_req, res) => {
  const [items, reminders, categories] = await Promise.all([
    prisma.item.findMany({ include: { category: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.reminder.count({ where: { status: "PENDING" } }),
    prisma.category.findMany({ include: { _count: { select: { items: true } } }, orderBy: { sortOrder: "asc" } }),
  ]);

  const allItems = await prisma.item.findMany();
  const totalSpend = allItems.reduce((acc, it) => acc + it.price, 0);
  const averageDailyCost =
    allItems.length > 0
      ? Number((allItems.map((it) => calcDailyCost(it.price, clampDaysOwned(it.purchaseDate))).reduce((a, b) => a + b, 0) / allItems.length).toFixed(2))
      : 0;

  res.json({
    totalItems: allItems.length,
    totalSpend: Number(totalSpend.toFixed(2)),
    pendingReminders: reminders,
    averageDailyCost,
    recentItems: items.map(toItemView),
    categoryOverview: categories.map((c) => ({ id: c.id, name: c.name, count: c._count.items })),
  });
});

app.get("/api/analytics/summary", async (_req, res) => {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  const allItems = await prisma.item.findMany();
  const views = allItems.map(toItemView);
  const high = views.filter((v) => v.dailyCost >= (settings?.highDailyCostThreshold ?? 5));
  const now = dayjs();
  const idle = allItems.filter((it) => {
    const ref = it.lastUsedAt ?? it.statusUpdatedAt;
    return now.diff(dayjs(ref), "day") >= (settings?.idleDaysThreshold ?? 60);
  });

  res.json({
    totalItems: allItems.length,
    totalSpend: Number(allItems.reduce((a, b) => a + b.price, 0).toFixed(2)),
    highDailyCostCount: high.length,
    idleItemsCount: idle.length,
  });
});

app.get("/api/analytics/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({ include: { _count: { select: { items: true } } } });
  const total = categories.reduce((a, b) => a + b._count.items, 0);
  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      count: c._count.items,
      ratio: total ? Number(((c._count.items / total) * 100).toFixed(2)) : 0,
    })),
  );
});

app.get("/api/analytics/high-daily-cost", async (_req, res) => {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  const items = (await prisma.item.findMany({ include: { category: true } }))
    .map(toItemView)
    .filter((i) => i.dailyCost >= (settings?.highDailyCostThreshold ?? 5))
    .sort((a, b) => b.dailyCost - a.dailyCost)
    .slice(0, 10);
  res.json(items);
});

app.get("/api/analytics/idle-items", async (_req, res) => {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  const threshold = settings?.idleDaysThreshold ?? 60;
  const items = await prisma.item.findMany({ include: { category: true } });
  const idle = items
    .map(toItemView)
    .filter((it) => {
      const ref = it.lastUsedAt ? dayjs(it.lastUsedAt) : dayjs(it.statusUpdatedAt);
      return dayjs().diff(ref, "day") >= threshold;
    });
  res.json(idle);
});

app.get("/api/settings", async (_req, res) => {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  res.json(settings);
});

app.patch("/api/settings", async (req, res) => {
  const schema = z
    .object({
      theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
      defaultReminderTime: z.string().optional(),
      toastEnabled: z.boolean().optional(),
      exportFormat: z.string().optional(),
      highDailyCostThreshold: z.number().min(0).optional(),
      idleDaysThreshold: z.number().int().min(1).optional(),
    })
    .strict();
  const data = schema.parse(req.body);
  const settings = await prisma.setting.update({ where: { id: 1 }, data });
  res.json(settings);
});

function toCsv(rows: any[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const head = keys.join(",");
  const body = rows
    .map((row) => keys.map((k) => JSON.stringify(row[k] ?? "")).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

async function exportFile(type: "json" | "csv" | "backup") {
  const exportDir = path.join(dataDir, "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const stamp = dayjs().format("YYYYMMDD-HHmmss");

  if (type === "backup") {
    const dbPath = path.join(dataDir, "app.db");
    if (!fs.existsSync(dbPath)) {
      throw new Error("数据库文件不存在，无法导出备份");
    }
    const fileName = `backup-${stamp}.db`;
    const out = path.join(exportDir, fileName);
    fs.copyFileSync(dbPath, out);
    return { filePath: out, fileName };
  }

  const payload = {
    categories: await prisma.category.findMany(),
    items: await prisma.item.findMany(),
    reminderRules: await prisma.reminderRule.findMany(),
    reminders: await prisma.reminder.findMany(),
    settings: await prisma.setting.findMany(),
  };

  if (type === "json") {
    const fileName = `export-${stamp}.json`;
    const out = path.join(exportDir, fileName);
    fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf-8");
    return { filePath: out, fileName };
  }

  const fileName = `export-items-${stamp}.csv`;
  const out = path.join(exportDir, fileName);
  fs.writeFileSync(out, toCsv(payload.items), "utf-8");
  return { filePath: out, fileName };
}

app.post("/api/export/json", async (_req, res) => {
  try {
    res.json(await exportFile("json"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出 JSON 失败";
    res.status(500).json({ message });
  }
});

app.post("/api/export/csv", async (_req, res) => {
  try {
    res.json(await exportFile("csv"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出 CSV 失败";
    res.status(500).json({ message });
  }
});

app.post("/api/export/backup", async (_req, res) => {
  try {
    res.json(await exportFile("backup"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出备份失败";
    res.status(500).json({ message });
  }
});

app.get("/api/export/:type/download", async (req, res) => {
  try {
    const type = z.enum(["json", "csv", "backup"]).parse(req.params.type);
    const file = await exportFile(type);
    res.download(file.filePath, file.fileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出下载失败";
    res.status(500).json({ message });
  }
});

async function scanReminders() {
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  const highThreshold = settings?.highDailyCostThreshold ?? 5;
  const now = dayjs();

  const items = await prisma.item.findMany({ include: { reminderRules: true } });
  for (const item of items) {
    const daysOwned = clampDaysOwned(item.purchaseDate);
    const dailyCost = calcDailyCost(item.price, daysOwned);

    if (dailyCost >= highThreshold) {
      const exists = await prisma.reminder.findFirst({
        where: {
          itemId: item.id,
          type: "HIGH_DAILY_COST",
          status: { in: ["PENDING", "SNOOZED"] },
        },
      });

      if (!exists) {
        await prisma.reminder.create({
          data: {
            itemId: item.id,
            title: "高日均成本提醒",
            description: `当前日均成本 ${dailyCost} 元/天，建议关注使用效率。`,
            type: "HIGH_DAILY_COST",
            dueAt: now.toDate(),
            status: "PENDING",
          },
        });
      }
    }

    for (const rule of item.reminderRules.filter((r) => r.enabled)) {
      if (rule.type === "FIXED_CYCLE" && rule.nextTriggerAt && now.isAfter(dayjs(rule.nextTriggerAt))) {
        await prisma.reminder.create({
          data: {
            itemId: item.id,
            ruleId: rule.id,
            title: "固定周期提醒",
            description: "已到提醒周期，请检查是否需要更换或补购。",
            type: "FIXED_CYCLE",
            dueAt: now.toDate(),
          },
        });
        await prisma.reminderRule.update({
          where: { id: rule.id },
          data: { nextTriggerAt: dayjs(rule.nextTriggerAt).add(rule.cycleDays ?? 30, "day").toDate() },
        });
      }
    }
  }
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ success: false, message: msg });
});

async function start() {
  await ensureSeed();
  await scanReminders();
  cron.schedule("*/5 * * * *", async () => {
    await scanReminders();
  });

  app.listen(port, () => {
    console.log(`API started at http://localhost:${port}`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
