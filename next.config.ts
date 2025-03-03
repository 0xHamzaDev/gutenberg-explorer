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
		]
	},
	typescript: {
		ignoreBuildErrors: true
	}
}

export default nextConfig
