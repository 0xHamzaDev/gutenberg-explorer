'use client'
import Link from 'next/link'
import Balancer from 'react-wrap-balancer'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

export function HeroSection() {
	const { user } = useUser()

	return (
		<section
			id="about"
			aria-label="hero section"
			className="mt-16 w-full md:mt-48"
		>
			<div className="container flex flex-col items-center gap-6 text-center">
				<h1 className="animate-fade-up font-urbanist text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
					<Balancer>
						Choose Your Next Book Faster With{' '}
						<span className="bg-gradient-to-r from-[#d13abd] to-[#eebd89] bg-clip-text font-extrabold text-transparent">
							Gutenberg AI
						</span>
					</Balancer>
				</h1>

				<h3 className="max-w-4xl animate-fade-up text-muted-foreground sm:text-xl sm:leading-8">
					<Balancer>
						Your go-to reading assistant. The ultimate, AI-powered,
						open-source app, Gutenberg AI delivers quick book
						summaries, insightful highlights, and personalized
						recommendations—everything you need to dive into books
						with ease.
					</Balancer>
				</h3>

				<div className="z-10 flex animate-fade-up flex-col justify-center gap-4 sm:flex-row">
					<Link
						href={user?.id ? '/dashboard' : '/auth/sign-up'}
						className={cn(
							buttonVariants({ size: 'xl' }),
							'transition-all duration-700 ease-out text-md md:hover:-translate-y-2 relative group flex items-center'
						)}
					>
						<span className="flex items-center transition-all duration-700 group-hover:mr-2">
							Get Started
						</span>
						<ArrowRight className="opacity-0 scale-90 translate-x-1 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-2 transition-all duration-700" />
					</Link>
				</div>
			</div>
		</section>
	)
}
