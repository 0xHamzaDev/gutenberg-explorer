import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { ClerkProvider } from '@clerk/nextjs'
import { Providers } from '@/components/providers/providers'
import { Footer } from '@/components/custom/footer'
import TopLoader from '@/components/custom/top-loader'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'

const geistSans = localFont({
	src: '../../public/fonts/GeistVF.woff',
	variable: '--font-geist-sans',
	weight: '100 900'
})

const geistMono = localFont({
	src: '../../public/fonts/GeistMonoVF.woff',
	variable: '--font-geist-mono',
	weight: '100 900'
})

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	minimumScale: 1,
	maximumScale: 1,
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: 'white' },
		{ media: '(prefers-color-scheme: dark)', color: 'black' }
	]
}

export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL as string),
	title: {
		default: 'Gutenberg AI',
		template: `%s - Gutenberg AI`
	},
	description:
		'An AI that helps you convert Gutenberg Library into a chatbot around the book.',
	authors: [
		{
			name: 'Hamza Alsherif',
			url: 'https://gutenberg.hamz4.com/'
		}
	],
	creator: 'Hamza Alsherif',
	keywords: [
		'AI',
		'Gutenberg AI',
		'Chatbot',
		'Gutenberg Project',
		'Book Chatbot',
		'Artificial Intelligence'
	],
	robots: {
		index: true,
		follow: true
	},
	openGraph: {
		type: 'website',
		locale: 'en_US',
		url: 'localhost:3000',
		title: 'Gutenberg AI',
		description:
			'An AI that helps you convert Gutenberg AI into a chatbot around the book.',
		siteName: 'Gutenberg AI',
		image: '/logo.svg'
	},
	icons: {
		icon: '/favicon.ico'
	}
}

export default function RootLayout({
	children
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<ClerkProvider>
			<html
				lang="en"
				className="overflow-x-hidden overflow-y-scroll"
				suppressHydrationWarning
			>
				<body
					className={cn(
						'w-full bg-background font-sans antialiased',
						geistMono.variable,
						geistSans.variable
					)}
				>
					<Providers>
						<TopLoader />
						{children}
						<Toaster richColors />
					</Providers>
				</body>
			</html>
		</ClerkProvider>
	)
}
