import { pollUser } from '@/app/(auth)/auth/actions'
import { auth } from '@clerk/nextjs/server'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger
} from '@/components/ui/sidebar'
import Breadcrumbs from '@/components/breadcrumb'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Dashboard',
	description:
		'An AI that helps you convert Gutenberg AI into a chatbot around the book.'
}

export default async function Layout({
	children
}: {
	children: React.ReactNode
}) {
	const { userId } = await auth()
	if (userId) {
		pollUser({
			clerkId: userId
		})
	}
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator
							orientation="vertical"
							className="mr-2 h-4"
						/>
						<Breadcrumbs />
					</div>
				</header>
				<main>{children}</main>
			</SidebarInset>
		</SidebarProvider>
	)
}
