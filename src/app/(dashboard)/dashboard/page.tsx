'use client'

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'
import {
	Book,
	BookOpen,
	MessageSquare,
	TrendingUp,
	Users,
	BarChart2,
	Calendar,
	Clock,
	Sparkles
} from 'lucide-react'
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	Legend,
	CartesianGrid,
	ResponsiveContainer,
	BarChart,
	Bar,
	PieChart,
	Pie,
	Cell
} from 'recharts'
import { ResponsiveCalendar } from '@nivo/calendar'
import {
	getUserTransactions,
	getUserTransactionsChartData,
	Transaction
} from './actions'
import useSWR from 'swr'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface TransactionChartData {
	month: string
	transactions: number
}

interface ReadingStats {
	totalBooks: number
	totalBooksInLibrary: number
	totalAuthors: number
	totalMessages: number
	userMessageCount: number
	botMessageCount: number
	averageMessagesPerBook: number
	booksWithMessages: number
	readingHoursData: { hour: number; count: number }[]
	readingDaysData: { name: string; count: number }[]
	daysSinceFirstRead: number
	daysSinceLastRead: number | null
	firstReadDate: string | null
	lastReadDate: string | null
	recentActivity: {
		id: string
		bookId: string
		title: string
		author: string | null
		date: string
		messageCount: number
		transactionId?: string
	}[]
	calendarData: { day: string; value: number }[]
	topSubjects: string[]
	recommendations: {
		id: string
		title: string
		author: string | null
		coverUrl: string | null
		relevanceScore: number
	}[]
}

const COLORS = [
	'#0088FE',
	'#00C49F',
	'#FFBB28',
	'#FF8042',
	'#8884d8',
	'#82ca9d'
]

const statsApiUrl = '/dashboard/stats'

function formatDate(dateString: string | null): string {
	if (!dateString) return 'N/A'
	const date = new Date(dateString)
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(date)
}

function RecommendedBooks({
	recommendations
}: {
	recommendations: ReadingStats['recommendations']
}) {
	const router = useRouter()

	if (!recommendations || recommendations.length === 0) {
		return null
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Recommended Books</CardTitle>
					<CardDescription>
						Personalized recommendations based on your reading
						habits from Gutenberg's library
					</CardDescription>
				</div>
				<Sparkles className="h-5 w-5 text-yellow-400" />
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
					{recommendations.map(book => (
						<div
							key={book.id}
							className="flex flex-col items-center cursor-pointer group relative"
							onClick={() =>
								router.push(`/dashboard/books/${book.id}`)
							}
						>
							<div className="absolute top-2 right-2 bg-primary/90 text-white text-xs font-semibold px-2 py-1 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity">
								{Math.min(
									99,
									Math.round(book.relevanceScore * 10)
								)}
								% match
							</div>
							<div className="relative w-full aspect-[2/3] mb-2 overflow-hidden rounded-md shadow-md transition-all duration-300 group-hover:shadow-lg">
								{book.coverUrl ? (
									<Image
										src={book.coverUrl}
										alt={book.title}
										fill
										sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
										loading="lazy"
										quality={75}
										className="object-cover transition-transform duration-300 group-hover:scale-105"
										onError={(e) => {
											const target = e.target as HTMLImageElement;
											target.src = '/placeholder-book.jpg';
										}}
									/>
								) : (
									<div className="flex items-center justify-center w-full h-full bg-muted">
										<Book className="h-12 w-12 text-muted-foreground" />
									</div>
								)}
								<div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-background/70 backdrop-blur-sm">
									<p className="text-xs font-medium truncate">
										{book.title}
									</p>
								</div>
							</div>
							<p className="text-xs text-center text-muted-foreground truncate w-full">
								{book.author || 'Unknown Author'}
							</p>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

function SubjectTags({ subjects }: { subjects: string[] }) {
	if (!subjects || subjects.length === 0) {
		return null
	}

	return (
		<div className="flex flex-wrap gap-2 mt-4">
			{subjects.map((subject, index) => (
				<div
					key={index}
					className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
				>
					{subject}
				</div>
			))}
		</div>
	)
}

export default function DashboardPage(): JSX.Element {
	const [activeTab, setActiveTab] = useState('overview')
	const router = useRouter()

	const { data: chartData, isLoading: chartLoading } = useSWR<
		TransactionChartData[]
	>('transaction-chart-data', getUserTransactionsChartData, {
		revalidateOnFocus: false
	})

	const { data: transactions, isLoading: transactionsLoading } = useSWR<
		Transaction[]
	>('user-transactions', getUserTransactions, { revalidateOnFocus: false })

	const { data: readingStats, isLoading: statsLoading } =
		useSWR<ReadingStats>(
			statsApiUrl,
			async url => {
				const response = await fetch(url)
				if (!response.ok) {
					throw new Error('Failed to fetch reading stats')
				}
				return response.json()
			},
			{ revalidateOnFocus: false }
		)

	const isLoading = chartLoading || transactionsLoading || statsLoading

	if (isLoading) {
		return <DashboardSkeleton />
	}

	// Fallback values in case API fails
	const {
		totalBooks = transactions?.length || 0,
		totalAuthors = 0,
		totalMessages = 0,
		daysSinceLastRead = null,
		readingHoursData = [],
		readingDaysData = []
	} = readingStats || {}

	return (
		<div className="flex flex-col space-y-6 p-8">
			<div className="flex flex-col space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground">
					Welcome to your reading analytics dashboard.
				</p>
			</div>

			<Tabs
				defaultValue="overview"
				className="w-full"
				onValueChange={setActiveTab}
			>
				<TabsList className="grid w-full max-w-md grid-cols-3">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
					<TabsTrigger value="activity">Activity</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6 pt-4">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 }}
						>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Books Read
									</CardTitle>
									<BookOpen className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{totalBooks}
									</div>
									<p className="text-xs text-muted-foreground">
										Lifetime reading total
									</p>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
						>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Authors Explored
									</CardTitle>
									<Users className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{totalAuthors}
									</div>
									<p className="text-xs text-muted-foreground">
										Different authors read
									</p>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
						>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Messages Exchanged
									</CardTitle>
									<MessageSquare className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{totalMessages}
									</div>
									<p className="text-xs text-muted-foreground">
										Total AI interactions
									</p>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.4 }}
						>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Reading Streak
									</CardTitle>
									<TrendingUp className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{daysSinceLastRead !== null
											? `${daysSinceLastRead} days ago`
											: 'N/A'}
									</div>
									<p className="text-xs text-muted-foreground">
										Since last reading
									</p>
								</CardContent>
							</Card>
						</motion.div>
					</div>

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.5 }}
							className="col-span-4"
						>
							<Card>
								<CardHeader>
									<CardTitle>Reading Progress</CardTitle>
									<CardDescription>
										Books read by month over time
									</CardDescription>
								</CardHeader>
								<CardContent className="h-[300px]">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<LineChart data={chartData || []}>
											<CartesianGrid
												strokeDasharray="3 3"
												opacity={0.2}
											/>
											<XAxis dataKey="month" />
											<YAxis />
											<Tooltip
												contentStyle={{
													borderRadius: '8px'
												}}
											/>
											<Legend />
											<Line
												type="monotone"
												dataKey="transactions"
												stroke="#8884d8"
												strokeWidth={2}
												activeDot={{ r: 8 }}
												name="Books Read"
											/>
										</LineChart>
									</ResponsiveContainer>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.6 }}
							className="col-span-3"
						>
							<Card>
								<CardHeader>
									<CardTitle>Top Authors</CardTitle>
									<CardDescription>
										Your most-read authors
									</CardDescription>
								</CardHeader>
								<CardContent className="h-[300px]">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<PieChart>
											<Pie
												data={
													readingStats?.recentActivity.map(
														activity => ({
															name:
																activity.author ||
																'Unknown',
															value: activity.messageCount
														})
													) || []
												}
												cx="50%"
												cy="50%"
												labelLine={false}
												outerRadius={80}
												fill="#8884d8"
												dataKey="value"
												label={({ name, percent }) =>
													`${name}: ${(percent * 100).toFixed(0)}%`
												}
											>
												{readingStats?.recentActivity.map(
													(activity, index) => (
														<Cell
															key={`cell-${index}`}
															fill={
																COLORS[
																	index %
																		COLORS.length
																]
															}
														/>
													)
												)}
											</Pie>
											<Tooltip />
										</PieChart>
									</ResponsiveContainer>
								</CardContent>
							</Card>
						</motion.div>
					</div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.7 }}
					>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between">
								<div>
									<CardTitle>
										Recent Reading Activity
									</CardTitle>
									<CardDescription>
										The last 10 books you've interacted with
									</CardDescription>
								</div>
								<Button
									variant="outline"
									onClick={() =>
										router.push('/dashboard/library')
									}
								>
									View Library
								</Button>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Book</TableHead>
											<TableHead>Author</TableHead>
											<TableHead>Messages</TableHead>
											<TableHead>Last Read</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{!readingStats ||
										readingStats.recentActivity.length ===
											0 ? (
											<TableRow>
												<TableCell
													colSpan={4}
													className="text-center"
												>
													No reading activity found
												</TableCell>
											</TableRow>
										) : (
											readingStats.recentActivity
												.slice(0, 10)
												.map(activity => (
													<TableRow
														key={activity.id}
														className="cursor-pointer hover:bg-muted/50"
														onClick={() =>
															router.push(
																`/dashboard/library/${activity.bookId}`
															)
														}
													>
														<TableCell className="font-medium">
															{activity.title}
														</TableCell>
														<TableCell>
															{activity.author ||
																'Unknown'}
														</TableCell>
														<TableCell>
															{
																activity.messageCount
															}{' '}
															messages
														</TableCell>
														<TableCell>
															{activity.date}
														</TableCell>
													</TableRow>
												))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.8 }}
					>
						<RecommendedBooks
							recommendations={
								readingStats?.recommendations || []
							}
						/>
					</motion.div>
				</TabsContent>

				<TabsContent value="analytics" className="space-y-6 pt-4">
					<div className="grid gap-4 md:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Reading Time Distribution</CardTitle>
								<CardDescription>
									When you tend to read books
								</CardDescription>
							</CardHeader>
							<CardContent className="h-[300px]">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={readingHoursData}>
										<CartesianGrid
											strokeDasharray="3 3"
											opacity={0.2}
										/>
										<XAxis
											dataKey="hour"
											tickFormatter={hour => `${hour}:00`}
										/>
										<YAxis />
										<Tooltip
											formatter={(value, name, props) => [
												`${value} books`,
												'Count'
											]}
											labelFormatter={hour =>
												`${hour}:00 - ${(hour + 1) % 24}:00`
											}
										/>
										<Bar
											dataKey="count"
											fill="#8884d8"
											name="Books Read"
										/>
									</BarChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Weekly Reading Activity</CardTitle>
								<CardDescription>
									Which days you read the most
								</CardDescription>
							</CardHeader>
							<CardContent className="h-[300px]">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={readingDaysData}>
										<CartesianGrid
											strokeDasharray="3 3"
											opacity={0.2}
										/>
										<XAxis dataKey="name" />
										<YAxis />
										<Tooltip />
										<Bar
											dataKey="count"
											fill="#82ca9d"
											name="Books Read"
										/>
									</BarChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Message Analysis</CardTitle>
							<CardDescription>
								Your conversation patterns
							</CardDescription>
						</CardHeader>
						<CardContent className="h-[300px]">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={[
											{
												name: 'Your Messages',
												value:
													readingStats?.userMessageCount ||
													0
											},
											{
												name: 'AI Responses',
												value:
													readingStats?.botMessageCount ||
													0
											}
										]}
										cx="50%"
										cy="50%"
										labelLine={true}
										outerRadius={100}
										fill="#8884d8"
										dataKey="value"
										label={({ name, percent }) =>
											`${name}: ${(percent * 100).toFixed(0)}%`
										}
									>
										<Cell fill="#8884d8" />
										<Cell fill="#82ca9d" />
									</Pie>
									<Tooltip />
									<Legend />
								</PieChart>
							</ResponsiveContainer>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="activity" className="space-y-6 pt-4">
					<Card>
						<CardHeader>
							<CardTitle>Reading Calendar</CardTitle>
							<CardDescription>
								Your reading activity over time
							</CardDescription>
						</CardHeader>
						<CardContent className="h-[220px]">
							{isLoading ? (
								<div className="flex h-full w-full items-center justify-center">
									<div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
								</div>
							) : !readingStats?.calendarData ||
							  readingStats.calendarData.length === 0 ? (
								<div className="p-4 text-center">
									<div className="flex items-center justify-center space-x-4">
										<Calendar className="h-6 w-6" />
										<span className="text-lg font-medium">
											No reading data available
										</span>
									</div>
									<p className="mt-2 text-muted-foreground">
										Start reading books to see your activity
										calendar.
									</p>
								</div>
							) : (
								<ResponsiveCalendar
									data={readingStats.calendarData}
									from={(() => {
										const date = new Date()
										date.setFullYear(date.getFullYear() - 1)
										return date.toISOString().split('T')[0]
									})()}
									to={new Date().toISOString().split('T')[0]}
									emptyColor="#eeeeee"
									colors={[
										'#f7fafc',
										'#cbd5e0',
										'#a0aec0',
										'#718096',
										'#4a5568'
									]}
									margin={{
										top: 20,
										right: 40,
										bottom: 20,
										left: 40
									}}
									yearSpacing={40}
									monthBorderColor="#ffffff"
									dayBorderWidth={2}
									dayBorderColor="#ffffff"
									tooltip={data => (
										<div className="bg-background border border-border rounded-md p-2 shadow-lg">
											<strong>{data.day}</strong>:{' '}
											{data.value} books
										</div>
									)}
									legends={[
										{
											anchor: 'bottom-right',
											direction: 'row',
											translateY: 36,
											itemCount: 4,
											itemWidth: 42,
											itemHeight: 36,
											itemsSpacing: 14,
											itemDirection: 'right-to-left'
										}
									]}
								/>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Reading Summary</CardTitle>
							<CardDescription>
								Your reading journey stats
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										First Book Read
									</h3>
									<p className="text-base mt-1">
										{formatDate(
											readingStats?.firstReadDate || null
										)}
									</p>
								</div>
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										Latest Book Read
									</h3>
									<p className="text-base mt-1">
										{formatDate(
											readingStats?.lastReadDate || null
										)}
									</p>
								</div>
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										Total Reading Days
									</h3>
									<p className="text-base mt-1">
										{readingStats?.daysSinceFirstRead || 0}{' '}
										days
									</p>
								</div>
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										Books in Library
									</h3>
									<p className="text-base mt-1">
										{readingStats?.totalBooksInLibrary || 0}{' '}
										books
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Message Insights</CardTitle>
							<CardDescription>
								Analysis of your book discussions
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-8">
								<div className="space-y-2">
									<h3 className="text-lg font-medium">
										Total Messages
									</h3>
									<div className="flex items-center">
										<div className="w-full rounded-full bg-secondary">
											<div
												className="h-2 rounded-full bg-primary"
												style={{
													width: `${Math.min(100, (totalMessages / (totalBooks * 10)) * 100)}%`
												}}
											/>
										</div>
										<span className="ml-4 text-sm">
											{totalMessages}
										</span>
									</div>
									<p className="text-sm text-muted-foreground">
										{totalMessages > 0
											? `You average ${(totalMessages / totalBooks).toFixed(1)} messages per book.`
											: 'Start chatting with your books to see insights.'}
									</p>
								</div>
							</div>

							<div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
								{readingStats?.recentActivity
									.slice(0, 3)
									.map(activity => (
										<Card
											key={activity.id}
											className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
											onClick={() =>
												router.push(
													`/dashboard/library/${activity.transactionId}`
												)
											}
										>
											<div className="bg-primary h-2"></div>
											<CardContent className="p-4">
												<h4 className="font-medium truncate">
													{activity.title}
												</h4>
												<div className="flex justify-between items-center">
													<p className="text-xs text-muted-foreground">
														{activity.messageCount}{' '}
														messages
													</p>
													<p className="text-xs text-muted-foreground">
														ID:{' '}
														{activity.transactionId?.substring(
															0,
															8
														)}
													</p>
												</div>
												<Button
													variant="link"
													className="p-0 h-auto mt-2"
													onClick={e => {
														e.stopPropagation()
														router.push(
															`/dashboard/library/${activity.transactionId}`
														)
													}}
												>
													Continue conversation
												</Button>
											</CardContent>
										</Card>
									))}
							</div>

							<div className="mt-6">
								<h3 className="text-lg font-medium">
									Your Reading Interests
								</h3>
								<p className="text-sm text-muted-foreground mb-2">
									Topics you frequently explore in your
									reading
								</p>
								<SubjectTags
									subjects={readingStats?.topSubjects || []}
								/>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
}

function DashboardSkeleton(): JSX.Element {
	return (
		<div className="flex flex-col space-y-6 p-8">
			<div className="space-y-2">
				<div className="h-8 w-48 rounded-md bg-gray-200 animate-pulse" />
				<div className="h-4 w-72 rounded-md bg-gray-200 animate-pulse" />
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<div className="h-4 w-24 rounded-md bg-gray-200 animate-pulse" />
							<div className="h-4 w-4 rounded-full bg-gray-200 animate-pulse" />
						</CardHeader>
						<CardContent>
							<div className="h-8 w-12 rounded-md bg-gray-200 animate-pulse" />
							<div className="h-4 w-32 rounded-md bg-gray-200 animate-pulse mt-2" />
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
				<Card className="col-span-4">
					<CardHeader>
						<div className="h-6 w-48 rounded-md bg-gray-200 animate-pulse" />
						<div className="h-4 w-64 rounded-md bg-gray-200 animate-pulse" />
					</CardHeader>
					<CardContent className="h-[300px]">
						<div className="h-full w-full rounded-md bg-gray-200 animate-pulse" />
					</CardContent>
				</Card>
				<Card className="col-span-3">
					<CardHeader>
						<div className="h-6 w-48 rounded-md bg-gray-200 animate-pulse" />
						<div className="h-4 w-64 rounded-md bg-gray-200 animate-pulse" />
					</CardHeader>
					<CardContent className="h-[300px]">
						<div className="h-full w-full rounded-md bg-gray-200 animate-pulse" />
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
