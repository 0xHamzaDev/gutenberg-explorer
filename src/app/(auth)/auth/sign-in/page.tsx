'use client'
import { Button } from '@/components/ui/button'
import { useSignIn, useSignUp } from '@clerk/nextjs'
import { OAuthStrategy } from '@clerk/types'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { SVGProps } from 'react'
import React from 'react'
import { toast } from 'sonner'
import { isClerkAPIResponseError } from '@clerk/nextjs/errors'
import Link from 'next/link'

type AuthStatus = 'none' | 'loading' | 'expired' | 'verified'

export default function HalfSidedGlassMorphismAuthentication() {
	const [emailAddress, setEmailAddress] = React.useState('')
	const [authStatus, setAuthStatus] = React.useState<AuthStatus>('none')
	const router = useRouter()
	const { signIn, isLoaded } = useSignIn()
	const { signUp, setActive } = useSignUp()

	if (!isLoaded) {
		return null
	}

	const { startEmailLinkFlow } = signIn.createEmailLinkFlow()

	const signInWith = async (strategy: OAuthStrategy) => {
		try {
			await signIn.authenticateWithRedirect({
				strategy,
				redirectUrl: '/auth/sso-callback',
				redirectUrlComplete: '/dashboard'
			})
		} catch (error) {
			console.log(error)
		}
	}

	async function handleSignIn(strategy: OAuthStrategy) {
		if (!signIn || !signUp) return null

		const userExistsButNeedsToSignIn =
			signUp.verifications.externalAccount.status === 'transferable' &&
			signUp.verifications.externalAccount.error?.code ===
				'external_account_exists'

		if (userExistsButNeedsToSignIn) {
			const res = await signIn.create({ transfer: true })

			if (res.status === 'complete') {
				setActive({
					session: res.createdSessionId
				})
			}
		}

		const userNeedsToBeCreated =
			signIn.firstFactorVerification.status === 'transferable'

		if (userNeedsToBeCreated) {
			const res = await signUp.create({
				transfer: true
			})

			if (res.status === 'complete') {
				if (!res.createdUserId) {
					throw new Error('User has no email address')
				}
				setActive({
					session: res.createdSessionId
				})
			}
		} else {
			signInWith(strategy)
		}
	}

	async function submit(e: React.FormEvent<HTMLFormElement>) {
		if (!signIn || !setActive) return
		e.preventDefault()
		setAuthStatus('loading')
		try {
			const si = await signIn.create({
				identifier: emailAddress,
				redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-email`,
				strategy: 'email_link'
			})
			const ff = si.supportedFirstFactors?.find(
				ff =>
					ff.strategy === 'email_link' &&
					ff.safeIdentifier === emailAddress
			)
			if (!ff) return
			const { emailAddressId } = ff

			const res = await startEmailLinkFlow({
				emailAddressId,
				redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-email`,
				strategy: 'email_link'
			})

			const verification = res.firstFactorVerification
			if (verification.verifiedFromTheSameClient()) {
				setAuthStatus('verified')
			} else if (verification.status === 'expired') {
				setAuthStatus('expired')
			}
			if (res.status === 'complete') {
				setActive({ session: res.createdSessionId })
				router.push('/dashboard')
			}
		} catch (err) {
			if (isClerkAPIResponseError(err)) {
				for (const e of err.errors) {
					toast.error(e.longMessage)
				}
			}
			console.error(JSON.stringify(err, null, 2))
		} finally {
			setAuthStatus('none')
		}
	}

	if (authStatus === 'expired') {
		return <div>Email link has expired</div>
	}

	if (authStatus === 'verified') {
		return <div>Signed in on other tab</div>
	}

	return (
		<section className="relative flex min-h-screen items-center justify-center bg-[url('https://images.unsplash.com/photo-1692606674482-effe67e384d9?q=80&w=3560&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')] bg-cover px-2 py-6 md:px-12 lg:justify-start lg:p-0 ">
			<motion.div
				transition={{
					duration: 1,
					ease: [0.43, 0.13, 0.23, 0.96],
					bounce: 0.2
				}}
				layoutId="auth-card"
				className="relative z-10 flex min-h-screen flex-1 flex-col border-white/50 border-t bg-white/60 px-4 py-10 backdrop-blur-2xl sm:justify-center md:flex-none md:px-20 lg:rounded-r-none lg:border-t-0 lg:border-l lg:py-24"
			>
				<div className="mx-auto w-full max-w-md sm:px-4 md:w-96 md:max-w-sm md:px-0">
					<h1 className="font-semibold text-3xl text-neutral-900 tracking-tighter">
						Gutenberg AI <br />
					</h1>
					<p className="mt-4 font-medium text-base text-neutral-500">
						Useful AI tools for the Gutenberg library books
					</p>

					<div className="mt-8">
						<button
							onClick={() => handleSignIn('oauth_google')}
							aria-label="Sign in with Google"
							className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 font-medium duration-200 hover:bg-white/50 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
							type="button"
						>
							<GoogleIcon className="size-6" />
							<span>Sign in with Google</span>
						</button>
						<div className="relative py-3">
							<div className="relative flex justify-center">
								<span className="before:-translate-y-1/2 after:-translate-y-1/2 px-2 text-neutral-500 text-sm before:absolute before:top-1/2 before:left-0 before:h-px before:w-4/12 after:absolute after:top-1/2 after:right-0 after:h-px after:w-4/12 sm:after:bg-neutral-300 sm:before:bg-neutral-300">
									Or continue with
								</span>
							</div>
						</div>
					</div>
					<form onSubmit={submit}>
						<div className="space-y-3">
							<div>
								<label
									className="mb-3 block font-medium text-black text-sm"
									htmlFor="email"
								>
									Email Address
								</label>
								<input
									className="block h-12 w-full appearance-none rounded-xl bg-white px-4 py-2  placeholder-neutral-300 duration-200 focus:outline-none focus:ring-neutral-300 sm:text-sm"
									id="email"
									required
									value={emailAddress}
									onChange={e =>
										setEmailAddress(e.target.value)
									}
									placeholder="example@gmail.com"
									type="email"
								/>
							</div>
							<div className="col-span-full">
								<Button
									className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-neutral-900 px-5 py-3 font-medium text-white duration-200 hover:bg-neutral-700 focus:ring-2 focus:ring-black focus:ring-offset-2"
									type="submit"
									disabled={authStatus === 'loading'}
								>
									{authStatus === 'loading'
										? 'Check your inbox for a link'
										: 'Sign in'}
								</Button>
							</div>
						</div>
						<div className="mt-6 flex justify-between">
							<a
								className="flex text-center font-medium text-gray-400 text-sm"
								href="/forms/signup"
							>
								Forgot your password?
							</a>
							<Link
								className="ml-auto text-primary hover:text-black"
								href="/auth/sign-up"
							>
								Sign up now
							</Link>
						</div>
					</form>
				</div>
			</motion.div>
		</section>
	)
}

function GoogleIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
	return (
		<svg
			height="100"
			viewBox="0 0 48 48"
			width="100"
			x="0px"
			xmlns="http://www.w3.org/2000/svg"
			y="0px"
			{...props}
		>
			<title>Google Logo</title>
			<path
				d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
				fill="#FFC107"
			/>
			<path
				d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
				fill="#FF3D00"
			/>
			<path
				d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
				fill="#4CAF50"
			/>
			<path
				d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
				fill="#1976D2"
			/>
		</svg>
	)
}
