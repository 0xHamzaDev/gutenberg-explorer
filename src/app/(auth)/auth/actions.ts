'use server'

import prisma from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'

export async function pollUser({ clerkId }: { clerkId: string }) {
	const client = await clerkClient()
	const user = await client.users.getUser(clerkId)
	if (!user.emailAddresses[0]?.emailAddress) {
		throw new Error('User has no email address')
	}

	await prisma.user.upsert({
		where: { id: user.id },
		update: {},
		create: {
			id: user.id,
			email: user.emailAddresses[0].emailAddress,
			firstName: user.firstName,
			lastName: user.lastName,
			imageUrl: user.imageUrl
		}
	})
}
