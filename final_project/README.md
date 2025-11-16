# Multi-Agent LLM Strategy Game

A turn-based strategy game where AI agents control factions using Large Language Models.

## Setup

### 1. Environment Variables
Create a `.env` file in the project root to store your API keys securely:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your actual API key:
```
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000

# Optional: Enable debug printing of all LLM responses
DEBUG_LLM_RESPONSES=true
```

**Important:** Never commit `.env` files to version control. The `.gitignore` file already excludes them.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Game
```bash
python main.py
```

### 4. Run Tests
```bash
# Run all tests
python tests/run_tests.py

# Run specific test categories
python tests/run_tests.py --llm-only          # LLM integration tests
python tests/run_tests.py -m test_game_state  # Specific module

# Run with debug output
DEBUG_LLM_RESPONSES=true python tests/run_tests.py
```

### 5. Test Categories

#### **Core Game Tests**
- Game state management
- Turn rotation and mechanics
- Entity system (units, factions, buildings)

#### **LLM Integration Tests**
- API key validation
- Agent decision-making flow
- Response parsing and validation
- Token usage tracking
- Error handling

#### **Sprite Generation Tests**
- LLM-based sprite creation
- Data format handling
- Performance validation
- Fallback mechanisms

#### **Environment Validation Tests**
- Configuration validation
- Personality system checks
- Memory usage monitoring

## Security Best Practices

- ✅ API keys are stored in `.env` files (excluded from git)
- ✅ Environment variables are loaded securely
- ✅ Graceful fallback when keys are missing
- ✅ Clear warnings when configuration is incomplete

## Alternative API Key Methods

### Windows Environment Variables
```cmd
set OPENAI_API_KEY=your_key_here
python main.py
```

### PowerShell
```powershell
$env:OPENAI_API_KEY="your_key_here"
python main.py
```

### Linux/Mac
```bash
export OPENAI_API_KEY=your_key_here
python main.py
```

## Project Structure

- `main.py` - Game launcher
- `config/` - Configuration files
- `agents/` - AI agent implementations
- `core/` - Game engine and state management
- `entities/` - Game objects (units, factions, etc.)
- `tests/` - Test suite
- `.env` - Your API keys (create this file)
- `.env.example` - Template for API key setup