'use client'

import { usePathname } from 'next/navigation'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { ChevronRight } from 'lucide-react'

function generateBreadcrumbs(path: string): { label: string; url: string }[] {
	const segments = path.split('/').filter(Boolean)
	return segments.map((segment, index) => {
		const isBookId =
			segments[index - 1] === 'books' && index === segments.length - 1
		return {
			label: isBookId
				? 'Book'
				: segment.charAt(0).toUpperCase() + segment.slice(1),
			url: '/' + segments.slice(0, index + 1).join('/')
		}
	})
}

export default function Breadcrumbs() {
	const path = usePathname()
	const breadcrumbs = generateBreadcrumbs(path)

	return (
		<Breadcrumb>
			<BreadcrumbList className="flex items-center">
				{breadcrumbs.map((crumb, index) => (
					<div key={crumb.url} className="flex items-center">
						<BreadcrumbItem>
							<BreadcrumbLink href={crumb.url}>
								{crumb.label}
							</BreadcrumbLink>
						</BreadcrumbItem>
						{index < breadcrumbs.length - 1 && (
							<BreadcrumbSeparator className="flex items-center justify-center mx-1 text-gray-500">
								<ChevronRight size={16} />
							</BreadcrumbSeparator>
						)}
					</div>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
