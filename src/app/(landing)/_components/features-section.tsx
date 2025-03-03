'use client'

import * as React from 'react'
import Balancer from 'react-wrap-balancer'
import { cn } from '@/lib/utils'

interface Feature {
	title: string
	description: string
}

export const features: Feature[] = [
	{
		title: 'Book Exploration',
		description:
			'Explore a vast collection of books from Project Gutenberg, and dive deep into their rich content with detailed metadata, AI-powered summaries, and more.'
	},
	{
		title: 'AI-Powered Summaries',
		description:
			'Leverage advanced AI models to generate concise and accurate plot summaries, making it easier to understand the essence of each book in just a few paragraphs.'
	},
	{
		title: 'Text Analysis Tools',
		description:
			'Get detailed insights into character development, sentiment analysis, and emotional tone, helping you better understand the narrative and its underlying themes.'
	},
	{
		title: 'Search and Filter',
		description:
			'Find your favorite books quickly with a powerful search and filtering system, allowing you to search by title, author, or keyword, and discover new books based on your preferences.'
	},
	{
		title: 'Interactive Experience',
		description:
			'Enjoy an interactive experience with personalized book recommendations and dynamic summaries, offering a fresh way to engage with literature and discover new authors.'
	}
]

export function FeaturesSection() {
	const [activeFeature, setActiveFeature] = React.useState<Feature | null>(
		features?.[0] || null
	)

	return (
		<section id="features" aria-label="features section" className="w-full">
			<div className="container relative grid gap-16">
				<div className="flex w-full flex-col items-center gap-6 text-center">
					<h2 className="font-urbanist text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
						<Balancer>
							Discover Our{' '}
							<span className="bg-gradient-to-r from-[#d13abd] to-[#eebd89] bg-clip-text text-transparent">
								Features
							</span>
						</Balancer>
					</h2>
					<h3 className="max-w-2xl leading-normal text-muted-foreground sm:text-xl sm:leading-8">
						<Balancer>
							Our project aims to provide a seamless experience
							for discovering, exploring, and analyzing books from
							Project Gutenberg. Using advanced AI models, we
							offer plot summaries, sentiment analysis, and
							character insights, helping readers better
							understand and engage with literature.
						</Balancer>
					</h3>
				</div>

				<div className="grid items-center justify-center gap-2 sm:gap-0 md:grid-cols-12">
					<div className="flex overflow-x-auto pb-4 sm:mx-0 sm:overflow-visible sm:pb-0 md:col-span-5">
						<div className="md::flex-row flex w-full flex-col gap-2 whitespace-nowrap sm:mx-auto md:mx-0 md:block md:gap-0 md:gap-y-1">
							{features.map(feature => (
								<div
									key={feature.title}
									className={cn(
										'group relative rounded-2xl text-center md:rounded-l-xl md:rounded-r-none md:p-6 md:text-start md:hover:bg-gradient-to-br md:hover:from-[#d13abd]/20 md:hover:to-[#eebd89]/20',
										activeFeature === feature
											? 'md:bg-gradient-to-br md:from-[#d13abd]/10 md:to-[#eebd89]/10'
											: 'md:cursor-pointer md:bg-background'
									)}
									onClick={() => setActiveFeature(feature)}
								>
									<h3 className="text-base font-semibold sm:text-xl md:text-sm lg:text-xl">
										{feature.title}
									</h3>
									<p className="mt-2 hidden text-sm text-muted-foreground sm:text-lg sm:leading-6 xl:block">
										<Balancer>
											{feature.description}
										</Balancer>
									</p>
								</div>
							))}
						</div>
					</div>

					<div className="md:block lg:col-span-7">
						<div className="relative w-auto overflow-hidden rounded-2xl md:h-[28rem] md:w-[32rem] md:border md:shadow-2xl lg:w-[46rem] xl:h-[50rem] xl:w-[69rem] 2xl:h-[48rem] 2xl:w-[67rem]">
							<div className="flex flex-col items-center justify-center h-full p-6 text-center">
								<h3 className="text-xl font-semibold">
									{activeFeature?.title}
								</h3>
								<p className="mt-4 text-lg">
									{activeFeature?.description}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
