'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import {
	BookOpen,
	Home,
	Library,
	Send,
	User,
	Bot,
	Clock,
	ArrowLeft,
	BookOpenCheck,
	ArrowDown
} from 'lucide-react'
import {
	getAIResponse,
	getBookContent,
	getBookTransactionDataById,
	summarizeContent
} from '../actions'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import {
	getTransactionMessages,
	saveMessageToTransaction,
	type Message
} from '../message-actions'
import { Badge } from '@/components/ui/badge'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'

const sections = [
	{ id: 'plot', title: 'Plot Summary', icon: BookOpen },
	{ id: 'words', title: 'Find Unusual Words', icon: BookOpenCheck },
	{ id: 'language', title: 'Detect the Language', icon: Library }
]

function ensureProperUrl(url: string | null | undefined): string {
	if (!url) return '/images/book.jpg'

	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return `https:${url.startsWith('//') ? url : `//${url}`}`
	}

	return url
}

interface BookData {
	id: string
	userId: string
	bookId: string
	bookTitle: string
	bookAuthor: string | null
	bookCover: string | null
	messages?: string[]
	updatedAt: Date
	createdAt: Date
}

function formatTimestamp(date: Date | undefined): string {
	if (!date) return ''
	return new Date(date).toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	})
}

function AIChatSkeleton() {
	return (
		<div className="container mx-auto py-1 px-4 md:px-6 h-[calc(100vh-4rem)] max-h-screen flex flex-col">
			<div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-full overflow-hidden flex-grow">
				<div className="order-2 lg:order-1 h-full flex max-h-[calc(100vh-6rem)]">
					<Card className="shadow-sm w-full flex flex-col">
						<CardHeader className="pb-3 shrink-0">
							<div className="w-full aspect-[3/4] bg-muted rounded-lg relative overflow-hidden mb-4 animate-pulse"></div>
							<div className="h-6 w-3/4 bg-muted rounded animate-pulse mb-2"></div>
							<div className="h-4 w-1/2 bg-muted rounded animate-pulse"></div>
						</CardHeader>

						<CardContent className="pb-6 flex-grow overflow-y-auto">
							<div className="mb-4">
								<div className="h-4 w-32 bg-muted rounded animate-pulse mb-3"></div>
								<div className="space-y-2">
									{[1, 2, 3].map(i => (
										<div
											key={i}
											className="h-10 bg-muted rounded animate-pulse"
										></div>
									))}
								</div>
							</div>

							<div className="h-8 w-full bg-muted rounded animate-pulse"></div>
						</CardContent>
					</Card>
				</div>

				<div className="order-1 lg:order-2 h-full flex max-h-[calc(100vh-6rem)]">
					<Card className="shadow-sm w-full flex flex-col">
						<CardHeader className="pb-3 border-b shrink-0">
							<div className="flex justify-between items-center">
								<div>
									<div className="h-6 w-32 bg-muted rounded animate-pulse mb-2"></div>
									<div className="h-4 w-48 bg-muted rounded animate-pulse"></div>
								</div>
								<div className="h-6 w-16 bg-muted rounded animate-pulse"></div>
							</div>
						</CardHeader>

						<div className="p-6 flex-grow overflow-hidden">
							<div className="h-full flex flex-col justify-center items-center space-y-4">
								<div className="w-16 h-16 rounded-full bg-muted animate-pulse"></div>
								<div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
								<div className="h-4 w-64 bg-muted rounded animate-pulse"></div>
								<div className="h-4 w-56 bg-muted rounded animate-pulse"></div>
								<div className="grid grid-cols-3 gap-2 w-full max-w-md">
									{[1, 2, 3].map(i => (
										<div
											key={i}
											className="h-8 bg-muted rounded animate-pulse"
										></div>
									))}
								</div>
							</div>
						</div>

						<CardFooter className="pt-4 pb-6 border-t">
							<div className="flex w-full gap-2">
								<div className="h-10 flex-1 bg-muted rounded animate-pulse"></div>
								<div className="h-10 w-20 bg-muted rounded animate-pulse"></div>
							</div>
						</CardFooter>
					</Card>
				</div>
			</div>
		</div>
	)
}

function InvalidChatPage() {
	const router = useRouter()

	const handleRedirect = () => {
		router.push('/dashboard/library')
	}

	return (
		<div className="container mx-auto py-16 px-4 flex justify-center items-center min-h-[80vh]">
			<Card className="max-w-md w-full shadow-lg">
				<CardHeader className="text-center pb-2">
					<div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
						<BookOpen className="h-8 w-8 text-red-600" />
					</div>
					<CardTitle className="text-2xl font-bold text-red-600">
						Conversation Not Found
					</CardTitle>
					<CardDescription className="text-muted-foreground mt-1">
						We couldn't locate this conversation
					</CardDescription>
				</CardHeader>
				<CardContent className="text-center pb-2">
					<p className="text-sm text-muted-foreground mb-6">
						The transaction ID you're looking for is invalid or no
						longer exists. This might happen if the transaction was
						deleted or if you're using an incorrect link.
					</p>
				</CardContent>
				<CardFooter className="flex flex-col gap-2 pt-0">
					<Button onClick={handleRedirect} className="w-full">
						<Library className="w-4 h-4 mr-2" />
						Go to My Library
					</Button>
					<Button
						variant="outline"
						onClick={() => router.push('/dashboard')}
						className="w-full"
					>
						<Home className="w-4 h-4 mr-2" />
						Return to Dashboard
					</Button>
				</CardFooter>
			</Card>
		</div>
	)
}

export default function ChatPage(): JSX.Element {
	const [messages, setMessages] = useState<Message[]>([])
	const [input, setInput] = useState('')
	const [bookContent, setBookContent] = useState<string>('')
	const [bookData, setBookData] = useState<BookData | null>(null)
	const [isTyping, setIsTyping] = useState(false)
	const [isLoading, setLoading] = useState(true)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const [showScrollButton, setShowScrollButton] = useState(false)
	const scrollAreaRef = useRef<HTMLDivElement>(null)
	const router = useRouter()
	const [error, setError] = useState<string | null>(null)

	const { transactionId } = useParams()

	useEffect(() => {
		const handleScroll = () => {
			if (!scrollAreaRef.current) return

			const { scrollTop, scrollHeight, clientHeight } =
				scrollAreaRef.current
			const isScrollable = scrollHeight > clientHeight
			const isNotAtBottom = scrollTop < scrollHeight - clientHeight - 100

			setShowScrollButton(isScrollable && isNotAtBottom)
		}

		const scrollContainer = scrollAreaRef.current
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll)
			handleScroll()
		}

		return () => {
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', handleScroll)
			}
		}
	}, [messages])

	useEffect(() => {
		const fetchData = async () => {
			try {
				const bookTransactionData = await getBookTransactionDataById(
					transactionId as string
				)
				setBookData(bookTransactionData as BookData)

				if (bookTransactionData?.bookId) {
					const findBookContent = await getBookContent(
						bookTransactionData.bookId
					)
					if (findBookContent) {
						const summarizedContent =
							await summarizeContent(findBookContent)
						setBookContent(summarizedContent)
					}
				}
			} catch (error) {

				setLoading(false)
				setError('Failed to fetch book data')
			} finally {
				setLoading(false)
			}
		}

		if (transactionId) {
			fetchData()
		}
	}, [transactionId])

	useEffect(() => {
		const loadMessages = async () => {
			if (!transactionId) return

			try {
				const savedMessages = await getTransactionMessages(
					transactionId as string
				)
				if (savedMessages && savedMessages.length > 0) {
					setMessages(savedMessages)
				}
			} catch (error) {
				setError('Failed to load messages')
			}
		}

		loadMessages()
	}, [transactionId])

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	const handleSendMessage = async (messageText: string) => {
		if (!messageText.trim() || !transactionId) return

		setIsTyping(true)

		const newUserMessage: Message = {
			role: 'user',
			content: messageText,
			timestamp: new Date()
		}

		setMessages(prev => [...prev, newUserMessage])

		await saveMessageToTransaction(transactionId as string, newUserMessage)

		setInput('')

		try {
			const botResponse = await getAIResponse(messageText, bookContent)

			const newBotMessage: Message = {
				role: 'bot',
				content: botResponse,
				timestamp: new Date()
			}

			setMessages(prev => [...prev, newBotMessage])

			await saveMessageToTransaction(
				transactionId as string,
				newBotMessage
			)
		} catch (error) {
			const errorMessage: Message = {
				role: 'bot',
				content:
					"Sorry, I couldn't process your request. Please try again.",
				timestamp: new Date()
			}

			setMessages(prev => [...prev, errorMessage])

			await saveMessageToTransaction(
				transactionId as string,
				errorMessage
			)
		} finally {
			setIsTyping(false)
		}
	}

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	if (isLoading) return <AIChatSkeleton />
	if (!transactionId || !bookData) return <InvalidChatPage />

	function handleShortcuts(title: string): void {
		handleSendMessage(title)
	}

	return (
		<div className="container mx-auto py-1 px-4 md:px-6 h-[calc(100vh-4rem)] max-h-screen flex flex-col">

			<div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-full overflow-hidden flex-grow">
				<div className="order-2 lg:order-1 h-full flex max-h-[calc(100vh-6rem)]">
					<Card className="shadow-sm w-full flex flex-col overflow-hidden">
						<CardHeader className="pb-3 shrink-0">
							<div className="w-full aspect-[3/4] bg-muted rounded-lg relative overflow-hidden mb-4 shadow-md max-h-[30vh] lg:max-h-[40vh]">
								<Image
									src={ensureProperUrl(bookData?.bookCover)}
									alt={bookData?.bookTitle || 'Book Cover'}
									fill
									sizes="(max-width: 320px) 100vw, 320px"
									className="object-cover transition-transform hover:scale-105 duration-500"
								/>
							</div>
							<CardTitle className="text-xl font-semibold leading-tight line-clamp-2">
								{bookData?.bookTitle || 'Book Title'}
							</CardTitle>
							<CardDescription>
								By {bookData?.bookAuthor || 'Unknown Author'}
							</CardDescription>
						</CardHeader>

						<CardContent className="pb-4 overflow-y-auto flex-grow">
							<ScrollArea className="h-full pr-4">
								<div className="mb-4">
									<h3 className="text-sm font-medium text-muted-foreground mb-2">
										Conversation Starters
									</h3>
									<div className="space-y-2">
										{sections.map(section => {
											const Icon = section.icon
											return (
												<TooltipProvider
													key={section.id}
												>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																variant="outline"
																className="w-full justify-start font-normal text-left"
																onClick={() =>
																	handleShortcuts(
																		section.title
																	)
																}
															>
																<Icon className="h-4 w-4 mr-2 text-primary" />
																{section.title}
															</Button>
														</TooltipTrigger>
														<TooltipContent side="right">
															<p>
																Ask about{' '}
																{section.title.toLowerCase()}
															</p>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											)
										})}
									</div>
								</div>

								<div className="text-xs text-muted-foreground">
									<Badge
										variant="outline"
										className="text-xs mb-2"
									>
										Transaction ID:{' '}
										{typeof transactionId === 'string'
											? transactionId.substring(0, 8)
											: ''}
										...
									</Badge>
									{bookData?.createdAt && (
										<div className="flex items-center">
											<Clock className="h-3 w-3 mr-1" />
											Started:{' '}
											{new Date(
												bookData.createdAt
											).toLocaleDateString()}
										</div>
									)}
								</div>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>

				<div className="order-1 lg:order-2 h-full flex max-h-[calc(100vh-6rem)]">
					<Card className="shadow-sm w-full flex flex-col">
						<CardHeader className="pb-3 border-b shrink-0">
							<div className="flex justify-between items-center">
								<div>
									<CardTitle>Book Conversation</CardTitle>
									<CardDescription>
										Chat with AI about {bookData?.bookTitle}
									</CardDescription>
								</div>
								<Badge variant="secondary" className="ml-auto">
									{messages.length} messages
								</Badge>
							</div>
						</CardHeader>

						<div className="relative flex-grow overflow-hidden">
							<ScrollArea
								ref={scrollAreaRef}
								className="h-full pt-4 px-4"
							>
								<AnimatePresence initial={false}>
									{messages.length === 0 ? (
										<div className="h-full flex flex-col items-center justify-center py-12 px-4 text-center">
											<div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
												<BookOpen className="h-8 w-8 text-primary" />
											</div>
											<h3 className="text-lg font-medium mb-2">
												Start the conversation
											</h3>
											<p className="text-sm text-muted-foreground max-w-md mb-6">
												Ask questions about the book or
												use one of the conversation
												starters from the left panel.
											</p>
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-lg">
												{sections.map(section => (
													<Button
														key={section.id}
														variant="outline"
														size="sm"
														onClick={() =>
															handleShortcuts(
																section.title
															)
														}
														className="text-xs"
													>
														{section.title}
													</Button>
												))}
											</div>
										</div>
									) : (
										<div className="space-y-6">
											{messages.map((msg, index) => (
												<motion.div
													key={index}
													initial={{
														opacity: 0,
														y: 10
													}}
													animate={{
														opacity: 1,
														y: 0
													}}
													exit={{ opacity: 0 }}
													transition={{
														duration: 0.2
													}}
													className={cn(
														'flex gap-3',
														msg.role === 'user'
															? 'justify-end'
															: 'justify-start'
													)}
												>
													<div
														className={cn(
															'flex items-start gap-2 group max-w-[85%]',
															msg.role === 'user'
																? 'flex-row-reverse'
																: 'flex-row'
														)}
													>
														<div
															className={cn(
																'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
																msg.role ===
																	'user'
																	? 'bg-primary text-primary-foreground'
																	: 'bg-muted text-muted-foreground'
															)}
														>
															{msg.role ===
															'user' ? (
																<User className="h-4 w-4" />
															) : (
																<Bot className="h-4 w-4" />
															)}
														</div>

														<div className="flex flex-col gap-1">
															<div
																className={cn(
																	'rounded-2xl px-4 py-3 text-sm',
																	msg.role ===
																		'user'
																		? 'bg-primary text-primary-foreground'
																		: 'bg-muted'
																)}
															>
																{msg.role ===
																'bot' ? (
																	<ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0">
																		{
																			msg.content
																		}
																	</ReactMarkdown>
																) : (
																	<p>
																		{
																			msg.content
																		}
																	</p>
																)}
															</div>

															{msg.timestamp && (
																<span
																	className={cn(
																		'px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity',
																		msg.role ===
																			'user'
																			? 'text-right'
																			: 'text-left',
																		'text-muted-foreground'
																	)}
																>
																	{formatTimestamp(
																		msg.timestamp
																	)}
																</span>
															)}
														</div>
													</div>
												</motion.div>
											))}

											{isTyping && (
												<motion.div
													initial={{
														opacity: 0,
														y: 10
													}}
													animate={{
														opacity: 1,
														y: 0
													}}
													className="flex justify-start"
												>
													<div className="flex items-start gap-2 max-w-[85%]">
														<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
															<Bot className="h-4 w-4 text-muted-foreground" />
														</div>
														<div className="flex flex-col gap-1">
															<div className="rounded-2xl bg-muted px-4 py-3 text-sm">
																<div className="flex gap-1 items-center">
																	<div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></div>
																	<div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></div>
																	<div className="h-2 w-2 rounded-full bg-current animate-bounce"></div>
																</div>
															</div>
														</div>
													</div>
												</motion.div>
											)}

											<div ref={messagesEndRef} />
										</div>
									)}
								</AnimatePresence>
							</ScrollArea>

							{showScrollButton && (
								<Button
									variant="outline"
									size="icon"
									className="absolute bottom-4 right-4 rounded-full shadow-md opacity-90 hover:opacity-100"
									onClick={scrollToBottom}
								>
									<ArrowDown className="h-4 w-4" />
								</Button>
							)}
						</div>

						<CardFooter className="pt-4 pb-6 border-t">
							<form
								className="flex w-full gap-2"
								onSubmit={e => {
									e.preventDefault()
									handleSendMessage(input)
								}}
							>
								<Input
									placeholder="Type your message..."
									value={input}
									onChange={e => setInput(e.target.value)}
									className="flex-1 border-0 focus-visible:ring-1"
								/>
								<Button
									type="submit"
									disabled={!input.trim() || isTyping}
								>
									<Send className="h-4 w-4 mr-2" />
									Send
								</Button>
							</form>
						</CardFooter>
					</Card>
				</div>
			</div>
		</div>
	)
}
