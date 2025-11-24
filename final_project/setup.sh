#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
    echo "Please edit .env file and add your OpenAI API key"
fi

echo "Setup complete!"
echo "To start the game:"
echo "1. Edit .env file and add your OpenAI API key"
echo "2. Run: npm start"
echo "3. Open http://localhost:3000 in your browser"