import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined.");
}

const usePgAdapter =
  databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://");

const prismaOptions = usePgAdapter
  ? {
      adapter: new PrismaPg({
        connectionString: databaseUrl,
      }),
    }
  : {
      accelerateUrl: databaseUrl,
    };

const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
