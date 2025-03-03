import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import React from 'react'

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
	const { userId } = await auth()
	if (userId) {
		return redirect('/dashboard')
	}
	return <>{children}</>
}

export default AuthLayout
