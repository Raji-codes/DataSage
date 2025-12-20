
# DataSage - Autonomous Data Scientist

DataSage is an intelligent autonomous agent that cleans raw data, generates hypotheses, runs statistical tests, and visualizes insights using the Gemini 3 Pro model.

## Prerequisites

Before running the project, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (Version 18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## Setup Instructions

1. **Extract the ZIP**: Unzip the project folder to your local machine.
2. **Install Dependencies**: Open your terminal in the project folder and run:
   ```bash
   npm install
   ```
3. **Configure API Key**: 
   - Create a file named `.env` in the root directory.
   - Add your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey):
     ```env
     API_KEY=your_actual_api_key_here
     ```

## Running the App

To start the development server, run:
```bash
npm run dev
```

Once the server starts, open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

## Project Structure

- `App.tsx`: Main application logic and state management.
- `services/geminiService.ts`: Integration with the Google GenAI SDK.
- `components/`: UI components for file uploading and analysis visualization.
- `types.ts`: TypeScript interfaces for data consistency.
