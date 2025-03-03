# Gutenberg Explorer

## Overview

**Gutenberg Explorer** is a web application that allows users to explore, download, and analyze free e-books from Project Gutenberg. The platform provides users with an easy way to access thousands of public domain books and analyze them using AI-driven features, such as character identification, language detection, sentiment analysis, and plot summaries.

**Gutenberg AI** powers the analysis features, allowing users to interact with books in a more meaningful way, gaining insights and summaries on their reading material.

---

## Features

- **Explore Books**: Browse through Project Gutenberg’s collection of e-books.
- **Download Books**: Download e-books to read offline in various formats.
- **Text Analysis**: Analyze book content with features such as:
    - **Character Identification**: Detect key characters in the story.
    - **Language Detection**: Identify the language of the text.
    - **Sentiment Analysis**: Gauge the sentiment of the text (positive, neutral, or negative).
    - **Plot Summaries**: Get automatic summaries of books’ plots.

---

## Tech Stack

- **Frontend**: Next.js, TailwindCSS, Shadcn UI
- **Backend**: Node.js (for book metadata fetching)
- **AI**: Open AI for AI-driven features (text analysis, summarization)
- **Database**: Prisma (for storing book metadata and user preferences)
- **Deployment**: Vercel, Docker

---

## Installation

To get started with the development version of Gutenberg Explorer, clone the repository and follow the installation instructions:

### Prerequisites

- Node.js
- npm or yarn
- Docker (for containerized environments)

### Steps

1. Clone the repository:

    ```bash
    git clone https://github.com/0xHamzaDev/gutenberg-explorer.git
    cd gutenberg-explorer
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Set up environment variables by creating a `.env` file in the root directory and adding the necessary values (for API keys, database configuration, etc.).

    Here’s an example of the `.env` file:

    ```env
    # Database URL
    DATABASE_URL="your-database-url-here"

    # Authentication keys
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key-here"
    CLERK_SECRET_KEY="your-clerk-secret-key-here"
    NEXT_PUBLIC_BASE_URL="your-base-url-here"

    # Open AI API Key
    OPENAI_API_KEY="your-openai-api-key-here"
    ```

4. Run the development server:

    ```bash
    npm run dev
    ```

5. Open your browser and navigate to `http://localhost:3000` to view the application.

---

## Usage

- **Explore Books**: You can search for books by title, author, or genre. The platform will provide you with a list of available books to explore.
- **Download Books**: After finding a book, you can download it in various formats (ePub, HTML, plain text).
- **Analyze Text**: Once you've selected a book, you can analyze its content for sentiment, characters, and plot summaries using the AI-driven features.

---

## Contributing

We welcome contributions! If you'd like to improve the project, follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Make your changes and commit them (`git commit -am 'Add new feature'`).
4. Push to your branch (`git push origin feature-name`).
5. Create a new pull request.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
