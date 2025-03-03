import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { toast } from 'sonner'

export default function SSOCallback() {
	return (
		<AuthenticateWithRedirectCallback
			signInForceRedirectUrl={`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`}
			signUpForceRedirectUrl={`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`}
		/>
	)
}
