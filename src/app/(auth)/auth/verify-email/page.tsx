'use client'

import React from 'react'
import { useClerk } from '@clerk/nextjs'
import { isEmailLinkError, EmailLinkErrorCode } from '@clerk/nextjs/errors'
import { toast } from 'sonner'
export default function Verification() {
	const [verificationStatus, setVerificationStatus] =
		React.useState('loading')

	const { handleEmailLinkVerification } = useClerk()

	React.useEffect(() => {
		async function verify() {
			try {
				await handleEmailLinkVerification({})

				toast.success('Successfully verified!')
				setVerificationStatus('verified')
			} catch (err: any) {
				let status = 'failed'
				if (
					isEmailLinkError(err) &&
					err.code === EmailLinkErrorCode.Expired
				) {
					status = 'expired'
				}
				setVerificationStatus(status)
			}
		}
		verify()
	}, [])

	if (verificationStatus === 'loading') {
		return <div>Loading...</div>
	}

	if (verificationStatus === 'failed') {
		return <div>Email link verification failed</div>
	}

	if (verificationStatus === 'expired') {
		return <div>Email link expired</div>
	}

	return (
		<div>
			Successfully verified. Return to the original tab to continue.
		</div>
	)
}
