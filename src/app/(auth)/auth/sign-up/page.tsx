'use client'
import { useClerk, useSignUp, useUser } from '@clerk/nextjs'
import type { SVGProps } from 'react'
import { motion, px } from 'framer-motion'
import React from 'react'
import { useRouter } from 'next/navigation'
import { OAuthStrategy } from '@clerk/types'
import { toast } from 'sonner'
import { isClerkAPIResponseError } from '@clerk/nextjs/errors'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function SignUp() {
	const [emailAddress, setEmailAddress] = React.useState('')
	const [expired, setExpired] = React.useState(false)
	const [verified, setVerified] = React.useState(false)
	const [firstName, setFirstName] = React.useState('')
	const [lastName, setLastName] = React.useState('')
	const router = useRouter()
	const { signUp, isLoaded, setActive } = useSignUp()
	const [isLoading, setIsLoading] = React.useState(false)

	if (!isLoaded) {
		return null
	}

	const { startEmailLinkFlow, cancelEmailLinkFlow } =
		signUp.createEmailLinkFlow()

	const signUpWith = async (strategy: OAuthStrategy) => {
		try {
			await signUp.authenticateWithRedirect({
				strategy,
				redirectUrl: '/auth/sso-callback',
				redirectUrlComplete: '/dashboard'
			})
		} catch (error) {
			console.log(error)
		}
	}

	async function onSignUp(e: React.FormEvent<HTMLFormElement>) {
		if (!emailAddress || !firstName || !lastName) {
			toast.error('Please fill in all fields')
			return
		}
		if (!signUp || !setActive) return

		e.preventDefault()
		setExpired(false)
		setVerified(false)

		try {
			setIsLoading(true)

			await signUp.create({ emailAddress, firstName, lastName })
			toast.success('Check your email for a verification link')

			const su = await startEmailLinkFlow({
				redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-email`
			})

			if (su.missingFields.length > 0) {
				toast.error('Please fill in all fields')
				console.log('missingFields', su.missingFields)
			}

			const verification = su.verifications.emailAddress
			if (verification.verifiedFromTheSameClient()) {
				setVerified(true)
			} else if (verification.status === 'expired') {
				setExpired(true)
			}

			if (su.status === 'complete') {
				setActive({
					session: su.createdSessionId,
					beforeEmit: async () => {
						router.push('/dashboard')
					}
				})
				return
			}
		} catch (err) {
			if (isClerkAPIResponseError(err)) {
				for (const e of err.errors) {
					toast.error(e.longMessage)
				}
			}
		} finally {
			setIsLoading(false)
		}
	}

	if (expired) {
		return <div>Email link has expired</div>
	}

	if (verified) {
		return <div>Signed in on other tab</div>
	}

	return (
		<section className="relative flex min-h-screen items-center justify-center bg-[url('https://images.unsplash.com/photo-1692606674482-effe67e384d9?q=80&w=3560&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')] bg-cover px-2 py-6 md:px-12 lg:justify-end lg:p-0 ">
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
							onClick={() => signUpWith('oauth_google')}
							aria-label="Sign up with Google"
							className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 font-medium duration-200 hover:bg-white/50 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
							type="button"
						>
							<GoogleIcon className="size-6" />
							<span>Sign up with Google</span>
						</button>
						<div className="relative py-3">
							<div className="relative flex justify-center">
								<span className="before:-translate-y-1/2 after:-translate-y-1/2 px-2 text-neutral-500 text-sm before:absolute before:top-1/2 before:left-0 before:h-px before:w-4/12 after:absolute after:top-1/2 after:right-0 after:h-px after:w-4/12 sm:after:bg-neutral-300 sm:before:bg-neutral-300">
									Or continue with
								</span>
							</div>
						</div>
					</div>
					<form onSubmit={onSignUp}>
						<div className="space-y-3">
							<div>
								<label
									className="mb-1 block font-medium text-black text-sm"
									htmlFor="email"
								>
									Email Address
								</label>
								<input
									onChange={e =>
										setEmailAddress(e.target.value)
									}
									required
									value={emailAddress}
									className="block h-12 w-full appearance-none rounded-xl bg-white px-4 py-2  placeholder-neutral-300 duration-200 focus:outline-none focus:ring-neutral-300 sm:text-sm"
									id="email"
									placeholder="example@gmail.com"
									type="email"
								/>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								<div>
									<label
										className="mb-1 block font-medium text-black text-sm"
										htmlFor="firstName"
									>
										First Name
									</label>
									<input
										onChange={e =>
											setFirstName(e.target.value)
										}
										required
										value={firstName}
										className="block h-12 w-full appearance-none rounded-xl bg-white px-4 py-2  placeholder-neutral-300 duration-200 focus:outline-none focus:ring-neutral-300 sm:text-sm"
										id="firstName"
										placeholder="John"
										type="text"
									/>
								</div>

								<div>
									<label
										className="mb-1 block font-medium text-black text-sm"
										htmlFor="lastName"
									>
										Last Name
									</label>
									<input
										onChange={e =>
											setLastName(e.target.value)
										}
										value={lastName}
										required
										className="block h-12 w-full appearance-none rounded-xl bg-white px-4 py-2  placeholder-neutral-300 duration-200 focus:outline-none focus:ring-neutral-300 sm:text-sm"
										id="lastName"
										placeholder="Doe"
										type="text"
									/>
								</div>
							</div>

							<div className="col-span-full">
								<Button
									disabled={isLoading}
									className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-neutral-900 px-5 py-3 font-medium text-white duration-200 hover:bg-neutral-700 focus:ring-2 focus:ring-black focus:ring-offset-2"
									type="submit"
								>
									{isLoading
										? 'Check your email for a verification link'
										: 'Sign Up'}
								</Button>
							</div>
						</div>
						<div className="mt-6 flex justify-between">
							<Link
								className="flex text-center font-medium text-gray-400 text-sm"
								href="/forget-password"
							>
								Forgot your password?
							</Link>
							<Link
								className="ml-auto text-primary hover:text-black"
								href="sign-in"
							>
								Sign In
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
