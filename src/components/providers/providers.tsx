'use client'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SmoothScrollProvider } from '@/components/providers/scroll-provider'

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<SmoothScrollProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				{children}
			</ThemeProvider>
		</SmoothScrollProvider>
	)
}
