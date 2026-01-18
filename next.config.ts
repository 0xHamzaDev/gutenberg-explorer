import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'www.gutenberg.org',
				port: '',
				pathname: '/**'
			}
		],
		minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
		formats: ['image/webp']
	},
	typescript: {
		ignoreBuildErrors: true
	},
	// Performance optimizations
	experimental: {
		// Use server actions directly for better performance
		serverActions: {
			bodySizeLimit: '10mb'
		},
		// Optimize with a faster module resolution
		optimizePackageImports: [
			'@radix-ui/react-icons',
			'lucide-react',
			'date-fns',
			'framer-motion'
		]
	},
	// Improve initial page load performance
	poweredByHeader: false,
	// Add compression for API routes (if using a custom server)
	compress: true
}

export default nextConfig
