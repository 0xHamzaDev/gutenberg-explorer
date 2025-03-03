import Link from 'next/link'
import Balancer from 'react-wrap-balancer'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/components/ui/accordion'

const frequentlyAskedQuestions = [
	{
		question: 'What is Gutenberg AI?',
		answer: 'Gutenberg AI is a web application designed to help users explore books from Project Gutenberg by providing detailed metadata, text analysis, and even interactive plot summaries. The app uses advanced AI techniques to analyze books, detect characters, summarize plots, and identify sentiment, making it an invaluable tool for book lovers and researchers alike.'
	},
	{
		question: 'How does Gutenberg AI summarize books?',
		answer: 'Gutenberg AI leverages large language models (LLMs) to process the full text of books and generate concise, easy-to-understand summaries. The AI looks at key themes, events, and character developments, then distills this information into a plot summary that captures the essence of the story while remaining accurate to the original text.'
	},
	{
		question: 'Can I search for specific books in Gutenberg AI?',
		answer: 'Yes, Gutenberg AI allows users to search for books by title. The search function is fast and efficient, making it easy to find specific works or explore books based on different genres, themes, or authors.'
	},
	{
		question: 'What types of text analysis does Gutenberg AI offer?',
		answer: 'Gutenberg AI offers several text analysis features, including character identification, sentiment analysis, language detection, and more. It provides insights into how characters interact, the emotional tone of the text, and even determines the language of the book to make it more accessible for global readers.'
	},
	{
		question: 'How does Gutenberg AI handle book metadata?',
		answer: "The app fetches detailed metadata for each book from Project Gutenberg, including title, author, publication date, and more. This information is displayed alongside the book's content, offering users a deeper understanding of the work before they dive into the full text."
	}
]

export function FAQSection() {
	return (
		<section id="faq" aria-label="faq section" className="w-full">
			<div className="container grid max-w-6xl gap-8 md:gap-16">
				<div className="flex w-full flex-col items-center gap-6 text-center">
					<h2 className="font-urbanist text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
						<Balancer>
							Frequently Asked{' '}
							<span className="bg-gradient-to-r from-[#d13abd] to-[#eebd89] bg-clip-text text-transparent">
								Questions
							</span>
						</Balancer>
					</h2>
					<h3 className="max-w-2xl leading-normal text-muted-foreground sm:text-xl sm:leading-8">
						<Balancer>
							Find the answers to the most common questions about
							our product.
						</Balancer>
					</h3>
				</div>

				<div className="grid gap-4 sm:gap-6 md:gap-8">
					{frequentlyAskedQuestions.map(item => (
						<Accordion
							key={item.question}
							type="single"
							collapsible
						>
							<AccordionItem value={item.question}>
								<AccordionTrigger className="sm:text-xl sm:leading-8">
									{item.question}
								</AccordionTrigger>
								<AccordionContent className="text-muted-foreground sm:text-lg sm:leading-8">
									<Balancer>{item.answer}</Balancer>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					))}
				</div>
			</div>
		</section>
	)
}
