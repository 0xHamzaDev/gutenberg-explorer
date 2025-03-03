import { Header } from '@/components/custom/navigation/header'
import { Footer } from '@/components/custom/footer'
import { HeroSection } from './_components/hero-section'
import { FeaturesSection } from './_components/features-section'
import { TechSection } from './_components/tech-section'
import { FAQSection } from './_components/faq-section'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
	return (
		<div className="flex flex-col overflow-hidden">
			<Header />
			<main className="flex-1">
				<div className="grid w-full grid-cols-1 items-center justify-center gap-16 md:gap-32">
					<HeroSection />
					<TechSection />
					<FeaturesSection />
					<FAQSection />
					<Separator />
				</div>
			</main>
			<Footer />
		</div>
	)
}
