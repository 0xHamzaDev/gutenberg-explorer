'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
	error,
	reset
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error('Dashboard error:', error)
	}, [error])

	return (
		<div className="flex items-center justify-center h-[80vh]">
			<Card className="w-full max-w-md mx-auto">
				<CardHeader>
					<div className="flex items-center space-x-2">
						<AlertTriangle className="h-6 w-6 text-destructive" />
						<CardTitle>Something went wrong</CardTitle>
					</div>
					<CardDescription>
						There was an error loading your dashboard data
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="bg-muted p-4 rounded-lg text-sm font-mono overflow-auto max-h-[200px]">
						{error.message || 'An unknown error occurred'}
					</div>
					<p className="mt-4 text-sm text-muted-foreground">
						Try refreshing the page or contact support if the
						problem persists.
					</p>
				</CardContent>
				<CardFooter className="flex justify-end space-x-2">
					<Button
						variant="outline"
						onClick={() => (window.location.href = '/dashboard')}
					>
						Go to Dashboard
					</Button>
					<Button onClick={() => reset()} className="gap-1">
						<RefreshCw className="h-4 w-4 mr-1" />
						Try Again
					</Button>
				</CardFooter>
			</Card>
		</div>
	)
}
