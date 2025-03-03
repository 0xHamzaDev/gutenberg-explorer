import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextApiRequest } from 'next'
import prisma from '@/lib/db'

export async function handleAuth(req: NextApiRequest) {
	'use server'
	const { userId, sessionId } = await auth(req)

	if (!sessionId || !userId) {
		return null
	}

	let user = await prisma.user.findUnique({
		where: { clerkId: userId }
	})

	if (!user) {
		const clerkUser = await clerkClient.users.getUser(userId)
		user = await prisma.user.create({
			data: {
				clerkId: userId,
				email: clerkUser.emailAddresses[0].emailAddress,
				name: clerkUser.firstName + ' ' + clerkUser.lastName,
				image: clerkUser.profileImageUrl
			}
		})
	}

	return { user }
}
