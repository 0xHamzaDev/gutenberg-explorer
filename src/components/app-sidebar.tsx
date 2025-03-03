'use client'

import * as React from 'react'
import {
	BookOpen,
	Bot,
	LogOut,
	Settings2,
	Home,
	Library,
	BookIcon,
	Sun,
	Moon,
	BookMarked,
	BookText,
	BookCopy
} from 'lucide-react'

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { CaretSortIcon, ComponentPlaceholderIcon } from '@radix-ui/react-icons'
import { useClerk, useUser } from '@clerk/nextjs'
import { Icons } from '@/components/icons'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

const data = {
	navMain: [
		{
			title: 'Dashboard',
			url: '/dashboard',
			icon: BookText
		},
		{
			title: 'My Library',
			url: '/dashboard/library',
			icon: BookMarked
		},
		{
			title: 'Explore Books',
			url: '/dashboard/books',
			icon: BookOpen
		},
		{
			title: 'Settings',
			url: '/dashboard/settings',
			icon: Settings2
		}
	]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { isMobile } = useSidebar()
	const { user } = useUser()
	const { signOut } = useClerk()
	const router = useRouter()
	const pathname = usePathname()
	const { theme, setTheme } = useTheme()

	const isActive = (url: string) => pathname === url

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<div className="sidebar-menu-item">
					<SidebarMenuButton
						size="lg"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						onClick={() => router.push('/dashboard')}
					>
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
							<Icons.gutenbergLogo className="size-4" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">
								Gutenberg AI
							</span>
						</div>
					</SidebarMenuButton>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Platform</SidebarGroupLabel>
					<SidebarMenu>
						{data.navMain.map(item => (
							<SidebarMenuItem
								key={item.title}
								onClick={() => router.push(item.url)}
							>
								<SidebarMenuButton
									tooltip={item.title}
									className={
										isActive(item.url)
											? 'bg-sidebar-accent text-sidebar-accent-foreground'
											: ''
									}
								>
									{item.icon && <item.icon />}
									<span>{item.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarImage
											src={
												user?.hasImage
													? user?.imageUrl
													: undefined
											}
											alt={user?.firstName}
										/>
										<AvatarFallback className="rounded-lg">
											CN
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">
											{user?.firstName}
										</span>
										<span className="truncate text-xs">
											{
												user?.emailAddresses[0]
													?.emailAddress
											}
										</span>
									</div>
									<CaretSortIcon className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
								side={isMobile ? 'bottom' : 'right'}
								align="end"
								sideOffset={4}
							>
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="h-8 w-8 rounded-lg">
											<AvatarImage
												src={
													user?.hasImage
														? user?.imageUrl
														: undefined
												}
												alt={user?.firstName}
											/>
											<AvatarFallback className="rounded-lg">
												CN
											</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">
												{user?.firstName}
											</span>
											<span className="truncate text-xs">
												{
													user?.emailAddresses[0]
														?.emailAddress
												}
											</span>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() =>
										router.push('/dashboard/settings')
									}
								>
									<Settings2 />
									Settings
								</DropdownMenuItem>
								<DropdownMenu>
									<DropdownMenuTrigger>
										<DropdownMenuItem>
											{theme === 'dark' ? (
												<Moon />
											) : (
												<Sun />
											)}
											Theme
										</DropdownMenuItem>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={() => setTheme('light')}
										>
											<Sun />
											Light
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => setTheme('dark')}
										>
											<Moon />
											Dark
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => setTheme('system')}
										>
											<Settings2 />
											System
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									color="focus:bg-red-500/70"
									onClick={() =>
										signOut({ redirectUrl: '/' })
									}
								>
									<LogOut />
									Log out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	)
}
