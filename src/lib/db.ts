import { PrismaClient } from '@prisma/client'

// Add production-optimized Prisma client configuration
const prismaClientSingleton = () => {
	return new PrismaClient({
		// Enable connection pooling in production for improved performance
		datasources: {
			db: {
				url: process.env.DATABASE_URL
			}
		},
		// Log queries only in development
		log:
			process.env.NODE_ENV === 'development'
				? ['query', 'error', 'warn']
				: ['error']
	})
}

declare global {
	var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
