'use client'

import { UserProfile } from '@clerk/nextjs'

export default function SettingsPage(): JSX.Element {
	return (
		<div className="flex min-h-screen w-full px-4 pt-2">
			<UserProfile
				routing="hash"
				appearance={{
					elements: {
						card: 'shadow-none'
					}
				}}
			/>
		</div>
	)
}
