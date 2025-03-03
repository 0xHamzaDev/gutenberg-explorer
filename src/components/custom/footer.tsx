import Link from 'next/link'

export function Footer({ ...props }) {
	return (
		<footer className="border-t bg-background" {...props}>
			<div className="container flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 mx-auto max-w-[1200px]">
				<p className="text-xs text-muted-foreground">
					© {new Date().getFullYear()} Gutenberg AI. All rights
					reserved.
				</p>
				<nav className="sm:ml-auto flex gap-4 sm:gap-6">
					<Link
						className="text-xs hover:underline underline-offset-4"
						href="/terms"
					>
						Terms of Service
					</Link>
					<Link
						className="text-xs hover:underline underline-offset-4"
						href="/policy"
					>
						Privacy Policy
					</Link>
				</nav>
			</div>
		</footer>
	)
}
