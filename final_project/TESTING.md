# Test Coverage Report

## Test Execution
Run the complete test suite with coverage:
```bash
npm run test:coverage
```

Run specific test types:
```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm test -- --watch     # Watch mode for development
```

## Coverage Goals

### Current Implementation Coverage
- **GameEngine.js**: Integration tests with mocked dependencies
- **GameState.js**: Full unit test coverage for all methods
- **Tile.js**: Complete coverage of tile mechanics
- **Faction.js**: Resource management and action tracking
- **ActionValidator.js**: All action type validation
- **AIAgent.js**: OpenAI integration and error handling
- **FunctionSchemas.js**: Schema validation and structure

### Unit Tests (tests/unit/)
| File | Coverage Areas |
|------|----------------|
| `Tile.test.js` | Constructor, defense bonus, income calculation, cloning |
| `Faction.test.js` | Resource management, turn tracking, action recording |
| `GameState.test.js` | Grid management, faction handling, victory conditions |
| `ActionValidator.test.js` | All 9 primary/secondary action validations |
| `AIAgent.test.js` | OpenAI API interaction, personality system, error handling |
| `FunctionSchemas.test.js` | Schema structure validation for all actions |

### Integration Tests (tests/integration/)
| File | Coverage Areas |
|------|----------------|
| `GameEngine.test.js` | Game flow, turn management, observer integration |
| `API.test.js` | REST endpoints, WebSocket communication, E2E scenarios |

## Test Structure

### Mocking Strategy
- **OpenAI API**: Mocked responses for predictable AI behavior testing
- **WebSocket**: Test server for real-time communication validation
- **File System**: In-memory operations for isolated testing

### Test Categories
1. **Unit Tests**: Individual class/module functionality
2. **Integration Tests**: Component interaction and data flow
3. **API Tests**: HTTP/WebSocket endpoint validation
4. **E2E Tests**: Complete game scenario validation

## Running Specific Tests

### Test individual files:
```bash
npm test -- tests/unit/GameState.test.js
npm test -- tests/integration/GameEngine.test.js
```

### Test with specific patterns:
```bash
npm test -- --testNamePattern="GameState"
npm test -- --testPathPattern="unit"
```

### Debug test output:
```bash
npm test -- --verbose
npm test -- --detectOpenHandles
```

## Coverage Expectations

### High Priority (>90% coverage):
- Core game logic (GameEngine, GameState, ActionValidator)
- AI agent communication (AIAgent)
- Critical game mechanics (Tile, Faction)

### Medium Priority (>80% coverage):
- API endpoints and WebSocket handling
- Function schema validation
- Error handling paths

### Coverage Reports
Jest generates detailed coverage reports in `coverage/` directory:
- `coverage/lcov-report/index.html` - Detailed HTML report
- `coverage/text-summary.txt` - Terminal summary
- `coverage/lcov.info` - LCOV format for CI integration

## Test Data Management

### Mock Data Sources:
- `tests/setup.js` - Global test configuration
- Test files contain inline mock data for consistency
- OpenAI responses use predefined function call examples
- Game state fixtures represent common scenarios

### Test Isolation:
- Each test uses fresh instances
- Mocks are reset between test suites
- No shared state between test files

## Continuous Integration

### Pre-commit Testing:
```bash
npm run test:coverage
```

### CI Pipeline Integration:
- Coverage reports compatible with popular CI services
- LCOV format supports GitHub Actions, Jenkins, CircleCI
- Threshold enforcement prevents coverage regression

## Notes
- WebSocket tests may require additional setup for CI environments
- OpenAI API mocks ensure consistent test execution without external dependencies
- Integration tests validate complete data flow between components
- All tests designed to run independently and in parallel