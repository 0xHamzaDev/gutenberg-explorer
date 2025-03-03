'use client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Metadata } from 'next'
import Head from 'next/head'

export default function NotFoundPage() {
	const router = useRouter()
	const [atoms, setAtoms] = useState<number[]>([])
	const [showZero, setShowZero] = useState(true)

	useEffect(() => {
		const numAtoms = Math.floor(Math.random() * 21) + 10
		const positions = Array.from({ length: numAtoms }, () => ({
			id: Math.random(),
			x: Math.random() * 100,
			y: Math.random() * 100,
			size: Math.random() * 10 + 10
		}))

		setAtoms(positions)
	}, [])

	const count = useMotionValue(0)
	const rounded = useTransform(count, latest => Math.round(latest))

	useEffect(() => {
		const controls = animate(count, 404, {
			duration: 1,
			ease: 'easeOut',
			onComplete: () => {
				setShowZero(false)
				animate(count, 0, { duration: 0 })
			}
		})
		return () => controls.stop()
	}, [count])

	return (
		<>
			<Head>
				<meta
					name="description"
					content="The page you're looking for doesn't exist."
				/>
				<meta property="og:title" content="404 - Page Not Found" />
				<meta
					property="og:description"
					content="The page you're looking for doesn't exist."
				/>
				<meta property="og:type" content="website" />
				<meta
					property="og:url"
					content={process.env.NEXT_PUBLIC_APP_URL}
				/>
				<title>404 - Page Not Found</title>
			</Head>
			<div className="relative flex items-center justify-center min-h-screen bg-background overflow-hidden">
				{atoms.map(atom => (
					<motion.div
						key={atom.id}
						className="absolute rounded-full bg-primary"
						style={{
							width: `${atom.size}px`,
							height: `${atom.size}px`,
							top: `${atom.y}%`,
							left: `${atom.x}%`
						}}
						animate={{
							x: ['100%', '-100%'],
							y: ['100%', '-100%'],
							opacity: [1, 0]
						}}
						transition={{
							repeat: Infinity,
							repeatType: 'loop',
							duration: Math.random() * 3 + 2,
							ease: 'easeInOut',
							delay: Math.random() * 2
						}}
					/>
				))}

				<motion.div
					className="text-center space-y-6"
					initial={{ opacity: 0, y: -50 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, ease: 'easeOut' }}
				>
					<motion.h1
						className="text-6xl font-bold text-muted-foreground"
						initial={
							showZero ? { opacity: 0, x: -50 } : { opacity: 0 }
						}
						animate={
							showZero
								? { opacity: 1, x: 0 }
								: {
										opacity: 1,
										y: ['0%', '-15%', '0%']
									}
						}
						transition={
							showZero
								? { duration: 0.6, delay: 0.2 }
								: {
										duration: 1.2,
										repeat: Infinity,
										repeatType: 'loop',
										ease: 'easeInOut',
										delay: 2
									}
						}
					>
						{showZero ? rounded : 404}
					</motion.h1>

					<motion.p
						className="text-lg text-muted-foreground"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.6, delay: 0.4 }}
					>
						Oops! The page you're looking for doesn't exist.
					</motion.p>

					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.6, delay: 0.6 }}
					>
						<Button
							onClick={() => router.push('/')}
							className="mt-4"
						>
							Go Back to Home
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</>
	)
}
