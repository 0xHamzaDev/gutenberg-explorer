'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Icons } from '@/components/icons'
import { Navigation } from '@/components/custom/navigation/navigation'
import { NavigationMobile } from '@/components/custom/navigation/navigation-mobile'
import { useUser, useClerk } from '@clerk/nextjs'
import ThemeToggle from '@/components/custom/theme-toggle'

export function Header(): JSX.Element {
	const { user } = useUser()
	const { signOut } = useClerk()
	const [isVisible, setIsVisible] = useState(true)
	const [lastScrollY, setLastScrollY] = useState(0)

	useEffect(() => {
		const handleScroll = () => {
			const currentScrollY = window.scrollY

			if (currentScrollY > lastScrollY) {
				setIsVisible(false)
			} else {
				setIsVisible(true)
			}

			setLastScrollY(currentScrollY)
		}

		window.addEventListener('scroll', handleScroll, { passive: true })

		return () => window.removeEventListener('scroll', handleScroll)
	}, [lastScrollY])

	return (
		<header
			className={cn(
				'fixed top-0 left-0 right-0 z-40 flex h-20 w-full bg-background/80 backdrop-blur-sm transition-transform duration-300',
				isVisible ? 'translate-y-0' : '-translate-y-full'
			)}
		>
			<div className="container flex items-center justify-between p-4">
				<Link
					href="/"
					className="flex items-center justify-center gap-2 text-lg font-bold tracking-wide transition-all duration-300 ease-in-out"
				>
					<Icons.gutenbergLogo className="size-6 md:hidden lg:flex" />
					<span className="hidden md:flex">Gutenberg AI</span>
				</Link>
				<Navigation />
				<div className="flex items-center justify-center">
					<ThemeToggle />
					<NavigationMobile />

					<nav className="space-x-1">
						{user ? (
							<DropdownMenu>
								<DropdownMenuTrigger
									asChild
									className={cn(
										buttonVariants({
											variant: 'user',
											size: 'icon'
										}),
										'transition-all duration-300 ease-in-out hover:opacity-70'
									)}
								>
									<Avatar className="size-9">
										{user?.imageUrl ? (
											<AvatarImage
												src={user?.imageUrl}
												alt={
													user?.username ??
													"user's profile picture"
												}
												className="size-7 rounded-full"
											/>
										) : (
											<AvatarFallback className="size-9 cursor-pointer p-1.5 text-xs capitalize">
												<Icons.user className="size-5 rounded-full" />
											</AvatarFallback>
										)}
									</Avatar>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									className="w-56"
									align="end"
									forceMount
								>
									<DropdownMenuLabel className="font-normal">
										<div className="flex flex-col space-y-1">
											<p className="text-sm font-medium leading-none">
												{user?.firstName}
											</p>
											<p className="text-xs leading-none text-muted-foreground">
												{
													user?.emailAddresses[0]
														.emailAddress
												}
											</p>
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuGroup>
										<DropdownMenuItem asChild>
											<Link href="/dashboard">
												<Icons.avatar
													className="mr-2 size-4"
													aria-hidden="true"
												/>
												Dashboard
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem asChild>
											<Link href="/dashboard/settings">
												<Icons.settings
													className="mr-2 size-4"
													aria-hidden="true"
												/>
												Settings
											</Link>
										</DropdownMenuItem>
									</DropdownMenuGroup>
									<DropdownMenuSeparator />
									<DropdownMenuItem asChild>
										<Button
											aria-label="Sign Out"
											variant="ghost"
											className="w-full justify-start text-sm"
											onClick={() =>
												signOut({ redirectUrl: '/' })
											}
										>
											<Icons.logout
												className="mr-2 size-4"
												aria-hidden="true"
											/>
											Sign out
										</Button>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<Link
								aria-label="Get started"
								href="/auth/sign-up"
								className={cn(
									buttonVariants({ size: 'sm' }),
									'ml-2'
								)}
							>
								Get Started
								<span className="sr-only">Get Started</span>
							</Link>
						)}
					</nav>
				</div>
			</div>
		</header>
	)
}
