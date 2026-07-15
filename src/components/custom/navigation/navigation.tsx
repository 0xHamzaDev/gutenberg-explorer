'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuList,
	navigationMenuTriggerStyle
} from '@/components/ui/navigation-menu'

const navItems = [
	{
		title: 'About',
		href: '#about'
	},
	{
		title: 'Features',
		href: '#features'
	},
	{
		title: 'FAQ',
		href: '#faq'
	}
]

export function Navigation() {
	return (
		<NavigationMenu className="hidden transition-all duration-300 ease-in-out md:flex">
			<NavigationMenuList>
				{navItems.map(item => (
					<NavigationMenuItem key={item.title} asChild>
						<Link
							href={item.href}
							className={cn(
								navigationMenuTriggerStyle(),
								'bg-transparent'
							)}
						>
							{item.title}
						</Link>
					</NavigationMenuItem>
				))}
			</NavigationMenuList>
		</NavigationMenu>
	)
}
