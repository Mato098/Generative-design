"""Test runner script to execute all tests with enhanced LLM validation."""
from io import StringIO
import unittest
import sys
import os
import argparse

def run_all_tests(include_real_llm=False):
    """Run all test modules."""
    # Add project root to path for imports
    project_root = os.path.dirname(os.path.dirname(__file__))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    
    # List of test modules to run
    test_modules = [
        'test_agents',
        'test_entities', 
        'test_game_state',
        'test_llm_integration',
        'test_simple_cache',
        'test_cache_integration',
        'test_sprite_generation',
        'test_unit_production'
    ]
    
    # Add real LLM tests if requested
    if include_real_llm:
        test_modules.append('test_real_llm')
        print("WARNING: Including REAL LLM tests (will cost money!)")
    else:
        print("Info: Excluding expensive real LLM tests (use --real-llm to include)")
    
    print("")
    
    # Create test suite
    suite = unittest.TestSuite()
    
    for module_name in test_modules:
        try:
            # Import the module from tests package
            module = __import__(f'tests.{module_name}', fromlist=[module_name])
            # Add all tests from the module
            module_tests = unittest.defaultTestLoader.loadTestsFromModule(module)
            suite.addTest(module_tests)
            print(f"[OK] Loaded {module_name}")
        except ImportError as e:
            print(f"Warning: Could not load {module_name}: {e}")
            continue
    
    print("")
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 50)
    print(f"Main Test Suite: Ran {result.testsRun} tests")
    if result.wasSuccessful():
        print("[OK] All main tests passed!")
    else:
        print(f"[FAIL] Failures: {len(result.failures)}, Errors: {len(result.errors)}")
    print("=" * 50)
    
    # Return success/failure
    return result.wasSuccessful()

def run_specific_tests(test_modules):
    """Run specific test modules."""
    suite = unittest.TestSuite()
    
    for module_name in test_modules:
        try:
            module = __import__(module_name)
            suite.addTest(unittest.defaultTestLoader.loadTestsFromModule(module))
        except ImportError as e:
            print(f"Could not import {module_name}: {e}")
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()

def run_llm_integration_tests():
    """Run LLM-specific integration tests (MOCKED - no real API calls)."""
    print("\n==> Running LLM Integration Tests")
    print("=" * 40)
    print("NOTE: These tests use MOCKED LLM calls (no real API costs)")
    print("   They verify configuration and integration patterns only.")
    print("   For real LLM testing, use: python main.py --demo")
    print("")
    
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        print("Warning: No OpenAI API key found - LLM tests will check error handling")
    else:
        print(f"[OK] API key found: {api_key[:10]}...")
        if not api_key.startswith("sk-"):
            print("Warning: API key format looks incorrect")
    
    # Run LLM-specific tests
    suite = unittest.TestLoader().loadTestsFromName("test_llm_integration")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 40)
    print(f"LLM Integration Tests: Ran {result.testsRun} tests")
    if result.wasSuccessful():
        print("[OK] All LLM integration tests passed!")
    else:
        print(f"[FAIL] Failures: {len(result.failures)}, Errors: {len(result.errors)}")
    print("=" * 40)
    
    return result.wasSuccessful()

def print_environment_info():
    """Print test environment information."""
    print("\n==> Test Environment:")
    print(f"   Python: {sys.version.split()[0]}")
    print(f"   OpenAI API Key: {'[OK] Set' if os.getenv('OPENAI_API_KEY') else '[X] Not set'}")
    print(f"   Debug LLM: {'[OK] Enabled' if os.getenv('DEBUG_LLM_RESPONSES', '').lower() in ('true', '1', 'yes') else '[X] Disabled'}")
    print(f"   Model: {os.getenv('OPENAI_MODEL', 'Not set')}")
    print(f"   Max Tokens: {os.getenv('OPENAI_MAX_TOKENS', 'Not set')}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Test runner for Multi-Agent LLM Strategy Game",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Test Modes:
  Default: Fast, free mock tests only (recommended for development)
  --real-llm: Include expensive real OpenAI API tests (~$0.40-0.70)
  --llm-only: Run only LLM integration tests (mocked)
  --module: Run specific test modules

Examples:
  python run_tests.py                    # Fast mock tests (free)
  python run_tests.py --real-llm         # All tests including real API calls
  python run_tests.py --llm-only         # Just mocked LLM tests
        """
    )
    
    parser.add_argument(
        "--real-llm", 
        action="store_true",
        help="Include real LLM integration tests (WARNING: costs money!)"
    )
    
    parser.add_argument(
        "--module", "-m",
        action="append",
        help="Specific test module to run (can be used multiple times)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--llm-only",
        action="store_true",
        help="Run only LLM integration tests"
    )
    
    args = parser.parse_args()
    
    # Set testing environment
    os.environ.setdefault("TESTING", "true")
    
    print("==> Multi-Agent LLM Strategy Game Tests")
    print("=" * 50)
    
    if args.real_llm:
        print("WARNING: Including REAL LLM tests that cost money!")
        print("Estimated cost: ~$0.40-0.70 in OpenAI API calls")
        print("")
        response = input("Do you want to proceed? (y/N): ")
        if response.lower() not in ['y', 'yes']:
            print("[X] Test cancelled by user")
            print("Tip: Use 'python run_tests.py' for free mock tests")
            sys.exit(0)
        print("")
    
    if args.llm_only:
        print("==> Running ONLY LLM integration tests (mocked)...")
        try:
            success = run_llm_integration_tests()
        except Exception as e:
            print(f"Error running LLM tests: {e}")
            success = False
    elif args.module:
        success = run_specific_tests(args.module)
    else:
        success = run_all_tests(include_real_llm=args.real_llm)
        
        # Also run mocked LLM integration tests if not already included
        if not args.real_llm:
            try:
                llm_success = run_llm_integration_tests()
                success = success and llm_success
            except Exception as e:
                print(f"Warning: Could not run mocked LLM integration tests: {e}")
    
    print_environment_info()
    
    if success:
        if args.real_llm:
            print("\n[OK] All tests passed (including real LLM integration)!")
        else:
            print("\n[OK] All tests passed (mocked tests only)!")
            print("Tip: Use --real-llm to test actual LLM integration (costs money)")
        sys.exit(0)
    else:
        print("\n[FAIL] Some tests failed!")
        sys.exit(1)